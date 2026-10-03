import { Injectable } from '@nestjs/common';
import { subject as asSubject } from '@casl/ability';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { EAbility, EUserRole } from '../auth/casl/ability.enum.js';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory.js';
import type { ISessionUser } from '../auth/session/session-user.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { kindOfMime } from './attachments/attachment-limits.js';
import type { TAllowedMime } from './attachments/detect-mime.js';
import type { ITicketAttachment } from './attachments/ticket-attachment.entity.js';
import { TicketAttachmentsRepository } from './attachments/ticket-attachments.repository.js';
import type { IAttachmentRef, ITicketEvent } from './events/ticket-event.entity.js';
import {
  AUTO_CLOSE_AFTER_HOURS,
  canTransition,
  eventActorOf,
  isTeamActor,
  type TTicketStatus,
  type TTransitionActor,
} from './lifecycle/ticket-lifecycle.js';
import type {
  AssignSchema,
  CommentCreateSchema,
  SurveyAnswerSchema,
  SurveyStateSchema,
  TicketEventListSchema,
  TransitionSchema,
} from './schemas/ticket-lifecycle.schema.js';
import { SURVEY_VALID_DAYS, type ITicketSurvey } from './surveys/ticket-survey.entity.js';
import { TicketSurveysRepository } from './surveys/ticket-surveys.repository.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketEntity } from './ticket.entity.js';
import { TicketsRepository } from './tickets.repository.js';
import { TicketsService } from './tickets.service.js';

type TComment = z.output<typeof CommentCreateSchema>;
type TTransition = z.output<typeof TransitionSchema>;
type TTicketResponse = Awaited<ReturnType<TicketsService['findOneByUuid']>>;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Ciclo de vida del ticket: comentarios, cambios de estado, asignación, cierre (manual o a las 48 h),
 * reapertura y encuesta CSAT. Cada acción deja un EVENTO inmutable (`TicketHistoryService`) del que salen
 * las métricas. Reglas: docs/standard/metrics.md §2 y `lifecycle/ticket-lifecycle.ts`.
 */
@Injectable()
export class TicketLifecycleService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly ticketsService: TicketsService,
    private readonly history: TicketHistoryService,
    private readonly attachments: TicketAttachmentsRepository,
    private readonly surveys: TicketSurveysRepository,
    private readonly usersRepository: UsersRepository,
    private readonly notifications: NotificationsService,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  // ── Historial ──────────────────────────────────────────────────────────────────────────────
  /** Cronológico. Las notas internas SOLO las ve el equipo. */
  async listEvents(uuid: string): Promise<z.output<typeof TicketEventListSchema>> {
    const { ticket, user } = await this.load(uuid);
    const team = this.history.isTeamMember(user);
    return {
      data: this.history
        .eventsOf(ticket.uuid)
        .filter((event) => team || event.visibility === 'public')
        .map((event) => this.toEventResponse(event)),
    };
  }

  // ── Comentarios ────────────────────────────────────────────────────────────────────────────
  async comment(uuid: string, dto: TComment): Promise<z.output<typeof TicketEventListSchema>['data'][number]> {
    const { ticket, user, actors } = await this.load(uuid);
    if (actors.size === 0) throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN, { entity: 'Ticket', uuid });
    if (ticket.status === 'closed') throw new CustomBusinessException(ERROR_CODES.TCK.CLOSED_NO_COMMENTS, { uuid });
    // Una nota interna solo la escribe el equipo; quien es solo solicitante comenta en público.
    const team = this.history.isTeamFor(ticket, user);
    if (dto.internal && !team) throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN, { entity: 'Ticket', uuid });

    const free = this.attachments.findFree(dto.attachmentIds, ticket.uuid, user.uuid);
    if (free.length !== dto.attachmentIds.length) throw new CustomBusinessException(ERROR_CODES.ATT.NOT_FOUND);
    const refs = free.map(toRef);
    const commentActor: TTransitionActor = team ? ([...actors].find(isTeamActor) ?? 'agent') : 'customer';

    this.history.record({
      ticket,
      type: dto.internal ? 'COMMENT_INTERNAL' : 'COMMENT_PUBLIC',
      actor: eventActorOf(commentActor),
      visibility: dto.internal ? 'internal' : 'public',
      body: dto.body,
      attachments: refs,
    });
    // Los adjuntos quedan amarrados al renglón recién escrito (ya no se pueden reutilizar en otro).
    const written = this.history.eventsOf(ticket.uuid).at(-1) as ITicketEvent;
    this.attachments.attachTo(dto.attachmentIds, written.uuid);

    // El solicitante que responde a «Pendiente del cliente» devuelve el ticket a «En atención» (sistema).
    if (commentActor === 'customer' && ticket.status === 'pending_customer') {
      this.apply(ticket, 'in_progress', 'system', user, { note: 'El solicitante respondió' });
    }
    if (!dto.internal) this.notifyAboutComment(ticket, user, commentActor);
    return this.toEventResponse(written);
  }

  // ── Cambio de estado ───────────────────────────────────────────────────────────────────────
  async transition(uuid: string, dto: TTransition): Promise<TTicketResponse> {
    const { ticket, user, actors } = await this.load(uuid);
    if (actors.size === 0) throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN, { entity: 'Ticket', uuid });
    const now = new Date();

    // Si la persona tiene varios papeles (solicitante y soporte, p. ej.), gana el que SÍ permite esa transición.
    const actor = ([...actors] as TTransitionActor[]).find((candidate) => canTransition(ticket.status, dto.to, candidate));
    if (!actor) throw new CustomBusinessException(ERROR_CODES.TCK.TRANSITION_NOT_ALLOWED, { entity: 'Ticket', field: 'status', value: `${ticket.status} → ${dto.to}` });
    if (ticket.status === 'closed' && dto.to === 'reopened' && !this.history.withinReopenWindow(ticket, now)) {
      throw new CustomBusinessException(ERROR_CODES.TCK.REOPEN_WINDOW_EXPIRED, { uuid });
    }

    // Evidencia que acompaña al cambio (p. ej. las fotos de la solución al resolver): ya subida, de esta persona y sin usar.
    const free = this.attachments.findFree(dto.attachmentIds, ticket.uuid, user.uuid);
    if (free.length !== dto.attachmentIds.length) throw new CustomBusinessException(ERROR_CODES.ATT.NOT_FOUND);
    this.apply(ticket, dto.to, actor, user, { note: dto.note ?? dto.resolution ?? null, resolution: dto.resolution ?? null, now, attachments: free.map(toRef) });
    if (free.length > 0) {
      const written = this.history.eventsOf(ticket.uuid).filter((event) => event.type === 'STATUS_CHANGED').at(-1);
      if (written) this.attachments.attachTo(dto.attachmentIds, written.uuid);
    }
    return this.ticketsService.findOneByUuid(uuid);
  }

  /** Asignar o reasignar. El supervisor y el administrador, a cualquiera; un agente solo se toma uno SIN responsable. */
  async assign(uuid: string, dto: z.output<typeof AssignSchema>): Promise<TTicketResponse> {
    const { ticket, user } = await this.load(uuid);
    const manager = user.role === EUserRole.ADMIN || user.role === EUserRole.SUPERVISOR;
    const selfTake = user.role === EUserRole.AGENT && !ticket.assigneeEmail && dto.assigneeEmail === user.email;
    if (!manager && !selfTake) {
      throw new CustomBusinessException(user.role === EUserRole.AGENT ? ERROR_CODES.TCK.ASSIGNMENT_FORBIDDEN : ERROR_CODES.AUT.FORBIDDEN);
    }
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      throw new CustomBusinessException(ERROR_CODES.TCK.TRANSITION_NOT_ALLOWED, { entity: 'Ticket', field: 'status', value: `${ticket.status} → assigned` });
    }
    const assignee = this.usersRepository.listAssignable().find((person) => person.email === dto.assigneeEmail);
    if (!assignee) throw new CustomBusinessException(ERROR_CODES.TCK.ASSIGNEE_NOT_FOUND);
    if (assignee.email === ticket.assigneeEmail) return this.ticketsService.findOneByUuid(uuid);

    const previous = ticket.assigneeEmail;
    const updated = Object.assign(new TicketEntity(), ticket, {
      assigneeEmail: assignee.email,
      status: ticket.status === 'new' ? ('assigned' as const) : ticket.status,
      updatedAt: new Date(),
      updatedBy: user.uuid,
    });
    void this.tickets.update(updated);
    if (ticket.status === 'new') {
      this.history.record({ ticket: updated, type: 'STATUS_CHANGED', actor: 'staff', from: 'new', to: 'assigned' });
    }
    this.history.record({ ticket: updated, type: 'ASSIGNED', actor: 'staff', assignee: assignee.email, body: previous ? `Antes: ${previous}` : null });
    this.notifications.notify({
      recipientUuid: assignee.uuid,
      type: 'TICKET_ASSIGNED',
      message: `Te asignaron ${ticket.code} «${ticket.title}»`,
      resourceType: 'Ticket',
      resourceUuid: ticket.uuid,
    });
    this.notifyRequester(updated, `${assignee.name} atenderá tu solicitud ${ticket.code}`);
    return this.ticketsService.findOneByUuid(uuid);
  }

  // ── Encuesta CSAT ──────────────────────────────────────────────────────────────────────────
  /** Solo la persona que registró el ticket ve su encuesta. */
  async surveyState(uuid: string): Promise<z.output<typeof SurveyStateSchema>> {
    const { survey } = await this.loadSurvey(uuid);
    return this.toSurveyState(survey, new Date());
  }

  async answerSurvey(uuid: string, dto: z.output<typeof SurveyAnswerSchema>): Promise<z.output<typeof SurveyStateSchema>> {
    const { ticket, user, survey } = await this.loadSurvey(uuid);
    const now = new Date();
    if (survey.answeredAt) throw new CustomBusinessException(ERROR_CODES.SRV.ALREADY_ANSWERED);
    if (now > survey.expiresAt) throw new CustomBusinessException(ERROR_CODES.SRV.EXPIRED);
    const answered: ITicketSurvey = { ...survey, answeredAt: now, score: dto.score, comment: dto.comment, resolved: dto.resolved };
    this.surveys.save(answered);
    this.history.record({ ticket, type: 'SURVEY_ANSWERED', actor: 'customer', actorUser: user, body: dto.comment });
    // Una calificación baja (1–2), o un «no se resolvió», llega al supervisor: es la señal de «escalamiento por insatisfacción».
    if (dto.score <= 2 || !dto.resolved) {
      for (const supervisor of this.usersRepository.listByRole(EUserRole.SUPERVISOR)) {
        this.notifications.notify({
          recipientUuid: supervisor.uuid,
          type: 'TICKET_SURVEY_ALERT',
          message: dto.resolved
            ? `Calificación baja (${dto.score}/5) en ${ticket.code} «${ticket.title}»`
            : `El solicitante dice que NO se resolvió ${ticket.code} «${ticket.title}» (${dto.score}/5)`,
          resourceType: 'Ticket',
          resourceUuid: ticket.uuid,
        });
      }
    }
    return this.toSurveyState(answered, now);
  }

  // ── Cierre automático (historia A4) ────────────────────────────────────────────────────────
  /**
   * Cierra los «Resuelto» sin respuesta del solicitante pasado el plazo (48 h por defecto; lo configura el administrador en
   * «Tareas programadas»). Cada cierre deja el evento, avisa al solicitante Y le deja la encuesta en su buzón. Devuelve cuántos cerró.
   */
  closeStaleResolved(now = new Date(), afterHours = AUTO_CLOSE_AFTER_HOURS): number {
    let closed = 0;
    for (const ticket of this.tickets.findAllRows()) {
      if (ticket.status !== 'resolved' || !ticket.resolvedAt) continue;
      if (now.getTime() - ticket.resolvedAt.getTime() < afterHours * HOUR_MS) continue;
      this.apply(ticket, 'closed', 'system', null, { note: `Cierre automático: ${afterHours} h sin respuesta`, now });
      closed += 1;
    }
    return closed;
  }

  // ── Internos ───────────────────────────────────────────────────────────────────────────────
  /** Aplica una transición YA validada: actualiza el ticket, escribe el evento y avisa. */
  private apply(
    ticket: TicketEntity,
    to: TTicketStatus,
    actor: TTransitionActor,
    user: ISessionUser | null,
    options: { note?: string | null; resolution?: string | null; now?: Date; attachments?: IAttachmentRef[] },
  ): void {
    const now = options.now ?? new Date();
    const from = ticket.status;
    const updated = Object.assign(new TicketEntity(), ticket, {
      status: to,
      updatedAt: now,
      updatedBy: user?.uuid ?? 'system',
      ...(to === 'resolved' ? { resolution: options.resolution ?? null, resolvedAt: now, closedAt: null } : {}),
      ...(to === 'closed' ? { closedAt: now } : {}),
      ...(to === 'reopened' ? { resolvedAt: null, closedAt: null } : {}),
    });
    void this.tickets.update(updated);
    this.history.record({
      ticket: updated,
      type: 'STATUS_CHANGED',
      actor: eventActorOf(actor),
      actorUser: actor === 'system' ? null : user,
      from,
      to,
      ...(to === 'closed' ? { by: actor === 'customer' ? ('customer' as const) : ('system' as const) } : {}),
      body: options.note ?? null,
      attachments: options.attachments ?? [],
      at: now,
    });
    this.notifyAboutStatus(updated, from, to, actor, user);
    if (to === 'closed') this.startSurvey(updated, now);
  }

  private notifyAboutStatus(ticket: TicketEntity, from: TTicketStatus, to: TTicketStatus, actor: TTransitionActor, user: ISessionUser | null): void {
    const assignee = ticket.assigneeEmail ? this.usersRepository.findByEmail(ticket.assigneeEmail) : null;
    const base = { resourceType: 'Ticket' as const, resourceUuid: ticket.uuid };
    const toRequester = (message: string): void => this.notifyRequester(ticket, message);

    switch (to) {
      case 'in_progress':
        if (isTeamActor(actor)) toRequester(`${ticket.code} está en atención`);
        break;
      case 'pending_customer':
        toRequester(`${ticket.code}: necesitamos más información de tu parte`);
        break;
      case 'escalated':
        toRequester(`${ticket.code} fue escalado a un nivel superior`);
        break;
      case 'resolved':
        toRequester(`${ticket.code} fue resuelto: revisa la solución y confirma el cierre`);
        break;
      case 'closed':
        // Cierre automático: se avisa al solicitante y al responsable; el manual ya lo sabe quien lo hizo.
        if (actor === 'system') {
          toRequester(`${ticket.code} se cerró automáticamente por falta de respuesta`);
          if (assignee) this.notifications.notify({ recipientUuid: assignee.uuid, type: 'TICKET_STATUS_CHANGED', message: `${ticket.code} se cerró automáticamente`, ...base });
        } else if (assignee) {
          this.notifications.notify({ recipientUuid: assignee.uuid, type: 'TICKET_STATUS_CHANGED', message: `${user?.name ?? 'El solicitante'} confirmó el cierre de ${ticket.code}`, ...base });
        }
        break;
      case 'reopened':
        // A3: el solicitante reabre → se avisa al agente asignado (y a los supervisores si no hay).
        if (assignee) {
          this.notifications.notify({ recipientUuid: assignee.uuid, type: 'TICKET_REOPENED', message: `${user?.name ?? 'El solicitante'} reabrió ${ticket.code} «${ticket.title}»`, ...base });
        } else {
          for (const supervisor of this.usersRepository.listByRole(EUserRole.SUPERVISOR)) {
            this.notifications.notify({ recipientUuid: supervisor.uuid, type: 'TICKET_REOPENED', message: `${ticket.code} se reabrió y no tiene responsable`, ...base });
          }
        }
        if (isTeamActor(actor)) toRequester(`${ticket.code} se reabrió`);
        break;
      default:
        break;
    }
    void from;
  }

  /**
   * Avisa al SOLICITANTE de un cambio de estado (CU01): buzón de notificaciones + tiempo real (SSE), y deja constancia en el
   * historial del ticket (evento `NOTIFIED`, postcondición del caso de uso). Si quien hace el cambio es el propio
   * solicitante nadie se notifica a sí mismo y no se registra nada. No hay correo: el buzón es el único canal.
   */
  private notifyRequester(ticket: TicketEntity, message: string): void {
    const sent = this.notifications.notify({
      recipientUuid: ticket.ownerUuid,
      type: 'TICKET_STATUS_CHANGED',
      message,
      resourceType: 'Ticket',
      resourceUuid: ticket.uuid,
    });
    if (!sent) return;
    this.history.record({ ticket, type: 'NOTIFIED', actor: 'system', actorUser: null, body: message });
  }

  private notifyAboutComment(ticket: TicketEntity, user: ISessionUser, actor: TTransitionActor): void {
    const base = { type: 'TICKET_COMMENTED' as const, resourceType: 'Ticket' as const, resourceUuid: ticket.uuid };
    if (isTeamActor(actor)) {
      this.notifications.notify({ recipientUuid: ticket.ownerUuid, message: `${user.name} respondió en ${ticket.code}`, ...base });
      return;
    }
    const assignee = ticket.assigneeEmail ? this.usersRepository.findByEmail(ticket.assigneeEmail) : null;
    if (assignee) this.notifications.notify({ recipientUuid: assignee.uuid, message: `${user.name} comentó en ${ticket.code}`, ...base });
  }

  /** Una sola encuesta por ticket, sin recordatorios: no es intrusiva (docs/standard/metrics.md §3.4). */
  private startSurvey(ticket: TicketEntity, now: Date): void {
    if (this.surveys.find(ticket.uuid)) return;
    const requester = this.usersRepository.findAdminByUuid(ticket.ownerUuid);
    if (!requester) return;
    this.surveys.add({
      ticketUuid: ticket.uuid,
      requesterUuid: ticket.ownerUuid,
      assigneeEmail: ticket.assigneeEmail || null,
      sentAt: now,
      expiresAt: new Date(now.getTime() + SURVEY_VALID_DAYS * DAY_MS),
      answeredAt: null,
      score: null,
      comment: null,
      resolved: null,
    });
    this.history.record({ ticket, type: 'SURVEY_SENT', actor: 'system', actorUser: null, at: now });
    this.notifications.notify({
      recipientUuid: requester.uuid,
      type: 'TICKET_SURVEY',
      message: `¿Se resolvió tu problema en ${ticket.code}? Cuéntanos cómo te atendimos (es opcional)`,
      resourceType: 'Ticket',
      resourceUuid: ticket.uuid,
    }, { allowSelf: true });
  }

  private toSurveyState(survey: ITicketSurvey, now: Date): z.output<typeof SurveyStateSchema> {
    return {
      state: survey.answeredAt ? 'answered' : now > survey.expiresAt ? 'expired' : 'pending',
      expiresAt: survey.expiresAt.toISOString(),
      score: survey.score,
      comment: survey.comment,
      resolved: survey.resolved,
    };
  }

  private async loadSurvey(uuid: string): Promise<{ ticket: TicketEntity; user: ISessionUser; survey: ITicketSurvey }> {
    const { ticket, user } = await this.load(uuid);
    const survey = this.surveys.find(ticket.uuid);
    // Solo quien registró el ticket, y solo si ya se cerró: para el resto «no hay encuesta» (no se revela).
    if (!survey || survey.requesterUuid !== user.uuid) throw new CustomBusinessException(ERROR_CODES.SRV.NOT_AVAILABLE);
    return { ticket, user, survey };
  }

  private toEventResponse(event: ITicketEvent): z.output<typeof TicketEventListSchema>['data'][number] {
    return {
      uuid: event.uuid,
      type: event.type,
      at: event.at.toISOString(),
      visibility: event.visibility,
      actor: event.actor,
      actorName: event.actorName,
      from: event.from ?? null,
      to: event.to ?? null,
      body: event.body,
      attachments: event.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        // Eventos anteriores al bucket no traen el tipo: se deduce del contenido ya detectado.
        kind: a.kind ?? kindOfMimeSafe(a.mimeType),
        durationSeconds: a.durationSeconds ?? null,
      })),
      assignee: event.assignee,
    };
  }

  /** El ticket DEBE ser legible para quien consulta (misma regla de fila que el CRUD): si no, 404. */
  private async load(uuid: string): Promise<{ ticket: TicketEntity; user: ISessionUser; actors: Set<TTransitionActor> }> {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    const ticket = await this.tickets.findByUuid(uuid);
    const ability = this.abilityFactory.createForUser(user);
    if (!ticket || ticket.isDeleted || !ability.can(EAbility.READ, asSubject('Ticket', Object.assign({}, ticket)))) {
      throw new CustomBusinessException(ERROR_CODES.TCK.NOT_FOUND, { uuid });
    }
    return { ticket, user, actors: this.history.actorsFor(ticket, user) };
  }
}

/** Referencia compacta a un adjunto para el renglón del historial. */
function toRef({ id, name, mimeType, size, kind, durationSeconds }: ITicketAttachment): IAttachmentRef {
  return { id, name, mimeType, size, kind, durationSeconds };
}

function kindOfMimeSafe(mime: string): 'image' | 'document' | 'video' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return kindOfMime(mime as TAllowedMime) ?? 'document';
}
