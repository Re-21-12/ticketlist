import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { CatalogsService } from '../catalogs/catalogs.service.js';
import { sanitizeRichText } from '../../core/sanitize/rich-text.js';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { BaseService } from '../../core/base.service.js';
import { RequestContext } from '../../core/context/request-context.js';
import { EUserRole } from '../auth/casl/ability.enum.js';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RelationshipsRepository } from '../relationships/relationships.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import type { TSubjects } from '../auth/casl/casl.types.js';
import type { TTicketResponse } from './dtos/ticket-response.dto.js';
import {
  TicketResponseSchema,
  type TicketCreateSchema,
  type TicketUpsertSchema,
} from './schemas/ticket.schema.js';
import { initialStatus } from './lifecycle/ticket-lifecycle.js';
import { policyFor } from './sla/sla-policy.js';
import { TicketHistoryService } from './ticket-history.service.js';
import { TicketEntity } from './ticket.entity.js';
import { TicketsRepository } from './tickets.repository.js';

type TCreate = z.output<typeof TicketCreateSchema>;
type TUpdate = z.output<typeof TicketUpsertSchema>;

/** `Date` local → 'YYYY-MM-DD' (columna `date`, sin corrimiento por zona horaria). */
function toIsoDate(date: Date | null): string | null {
  if (!date) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Capa de NEGOCIO de tickets. Hereda el CRUD de `BaseService`; aquí solo el mapeo del recurso y
 * la numeración. `toResponse` parsea con `TicketResponseSchema`: si alguien agrega un campo a la
 * entidad sin actualizar el contrato, falla aquí y no en el cliente.
 */
@Injectable()
export class TicketsService extends BaseService<TicketEntity, TTicketResponse, TCreate, TUpdate> {
  protected readonly codes = ERROR_CODES.TCK;
  protected readonly caslSubject: TSubjects = 'Ticket';

  constructor(
    protected override readonly repository: TicketsRepository,
    abilityFactory: CaslAbilityFactory,
    private readonly usersRepository: UsersRepository,
    private readonly relationshipsRepository: RelationshipsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly history: TicketHistoryService,
    private readonly catalogs: CatalogsService,
  ) {
    super(repository, abilityFactory);
  }

  /** Aviso a quien quedó asignado (al crear con responsable o al cambiarlo). */
  protected override onCreated(created: TicketEntity): void {
    // Historial: el registro del solicitante y, si ya trae responsable, su asignación.
    this.history.record({ ticket: created, type: 'CREATED', actor: 'customer', status: created.status, at: created.createdAt });
    if (created.assigneeEmail) {
      this.history.record({ ticket: created, type: 'ASSIGNED', actor: 'staff', assignee: created.assigneeEmail });
    }
    this.notifyAssignee(created);
  }

  /**
   * - Cambió el responsable → aviso al nuevo.
   * - Quien editó es ALTERNANTE del titular y la concesión tiene `notifyTitular` → aviso al titular
   *   (misma tabla de relaciones que autoriza, sin lógica paralela).
   */
  protected override onUpdated(before: TicketEntity, after: TicketEntity): void {
    if (before.status !== after.status) {
      this.history.record({ ticket: after, type: 'STATUS_CHANGED', actor: 'staff', from: before.status, to: after.status });
    }
    if (before.assigneeEmail !== after.assigneeEmail) {
      if (after.assigneeEmail) this.history.record({ ticket: after, type: 'ASSIGNED', actor: 'staff', assignee: after.assigneeEmail });
      this.notifyAssignee(after);
    }

    const actor = this.getActor();
    if (actor === after.ownerUuid) return;
    const relationship = this.relationshipsRepository.findActiveBetween(after.ownerUuid, actor);
    const grant = relationship?.grants.find((g) => g.objectType === 'Ticket');
    if (grant?.notifyTitular) {
      const actorName = this.usersRepository.findByUuid(actor)?.name ?? 'Un alternante';
      this.notificationsService.notify({
        recipientUuid: after.ownerUuid,
        type: 'TICKET_CHANGED_BY_ALTERNANTE',
        message: `${actorName} modificó ${after.code} «${after.title}»`,
        resourceType: 'Ticket',
        resourceUuid: after.uuid,
      });
    }
  }

  private notifyAssignee(ticket: TicketEntity): void {
    if (!ticket.assigneeEmail) return;
    const assignee = this.usersRepository.findByEmail(ticket.assigneeEmail);
    if (!assignee) return;
    this.notificationsService.notify({
      recipientUuid: assignee.uuid,
      type: 'TICKET_ASSIGNED',
      message: `Te asignaron ${ticket.code} «${ticket.title}»`,
      resourceType: 'Ticket',
      resourceUuid: ticket.uuid,
    });
  }

  /** El departamento debe ser un elemento activo del catálogo (los administra la organización, no un enum fijo). */
  private assertDepartment(department: string): void {
    if (!this.catalogs.isActiveCode('ticket-department', department)) {
      throw new CustomBusinessException(ERROR_CODES.TCK.DEPARTMENT_INVALID);
    }
  }

  protected toEntity(dto: TCreate, createdBy: string): TicketEntity {
    this.assertDepartment(dto.department);
    // Quien solo es solicitante (cliente) clasifica su caso, pero no asigna, ni estima, ni fija la complejidad:
    // eso es del equipo (CU05: la clasificación la completa el soporte).
    const team = this.history.isTeamMember(RequestContext.currentUser()) && RequestContext.currentUser()?.role !== EUserRole.AUDITOR;
    const assigneeEmail = team ? dto.assigneeEmail : '';
    const policy = policyFor(dto.priority, dto.type);
    return Object.assign(new TicketEntity(), {
      ...dto,
      description: sanitizeRichText(dto.description),
      assigneeEmail,
      complexity: team ? (dto.complexity ?? null) : null,
      estimateHours: team ? dto.estimateHours : null,
      dueDate: team ? toIsoDate(dto.dueDate) : null,
      status: initialStatus(!!assigneeEmail),
      slaResponseMinutes: policy.responseMinutes,
      slaResolutionMinutes: policy.resolutionMinutes,
      resolution: null,
      resolvedAt: null,
      closedAt: null,
      otherCategoryDetail: dto.category === 'other' ? (dto.otherCategoryDetail ?? null) : null,
      uuid: randomUUID(),
      ownerUuid: createdBy,
      code: this.repository.nextCode(),
      createdAt: new Date(),
      createdBy,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      isDeleted: false,
      restoredAt: null,
      restoredBy: null,
    });
  }

  protected mergeEntity(entity: TicketEntity, dto: TUpdate, updatedBy: string): TicketEntity {
    // Solo se revalida si CAMBIA: un departamento que se desactivó después no impide editar tickets viejos.
    if (dto.department !== entity.department) this.assertDepartment(dto.department);
    // Reclasificar (prioridad o tipo) cambia el plazo; el reloj sigue corriendo desde el registro.
    const policy = policyFor(dto.priority, dto.type);
    // El solicitante edita SU caso (título, descripción, tipo, categoría, urgencia); responsable, estimación, fecha y
    // complejidad son del equipo: si quien edita no es equipo en este ticket, esos campos se conservan.
    const team = this.history.isTeamFor(entity, RequestContext.currentUser());
    const assigneeEmail = team ? dto.assigneeEmail : entity.assigneeEmail;
    // Un ticket «Nuevo» al que se le pone responsable pasa a «Asignado».
    const status = entity.status === 'new' && !entity.assigneeEmail && assigneeEmail ? 'assigned' : entity.status;
    return Object.assign(new TicketEntity(), entity, {
      ...dto,
      description: sanitizeRichText(dto.description),
      assigneeEmail,
      complexity: team && dto.complexity !== undefined ? dto.complexity : entity.complexity,
      estimateHours: team ? dto.estimateHours : entity.estimateHours,
      dueDate: team ? toIsoDate(dto.dueDate) : entity.dueDate,
      status,
      slaResponseMinutes: policy.responseMinutes,
      slaResolutionMinutes: policy.resolutionMinutes,
      otherCategoryDetail: dto.category === 'other' ? (dto.otherCategoryDetail ?? null) : null,
      updatedAt: new Date(),
      updatedBy,
    });
  }

  /** Desde cuándo está en atención (asignado o en curso): arranca el reloj de la tarjeta. */
  private attendedSince(ticket: TicketEntity): Date | null {
    if (ticket.status !== 'assigned' && ticket.status !== 'in_progress') return null;
    const started = this.history
      .eventsOf(ticket.uuid)
      .filter((e) => e.type === 'ASSIGNED' || (e.type === 'STATUS_CHANGED' && (e.to === 'assigned' || e.to === 'in_progress')))
      .at(-1);
    return started?.at ?? ticket.createdAt;
  }

  protected toResponse(entity: TicketEntity): TTicketResponse {
    const now = new Date();
    const analysis = this.history.analyze(entity, now);
    const cycle = analysis.cycles.at(-1);
    return TicketResponseSchema.parse({
      uuid: entity.uuid,
      ownerUuid: entity.ownerUuid,
      requesterName: this.usersRepository.findAdminByUuid(entity.ownerUuid)?.name ?? 'Cuenta desconocida',
      code: entity.code,
      title: entity.title,
      description: entity.description,
      type: entity.type,
      category: entity.category,
      department: entity.department,
      complexity: entity.complexity,
      attendedSince: this.attendedSince(entity)?.toISOString() ?? null,
      ...(entity.otherCategoryDetail ? { otherCategoryDetail: entity.otherCategoryDetail } : {}),
      priority: entity.priority,
      status: entity.status,
      assigneeEmail: entity.assigneeEmail,
      assigneeName: this.history.nameOf(entity.assigneeEmail),
      estimateHours: entity.estimateHours,
      dueDate: entity.dueDate,
      notifyReporter: entity.notifyReporter,
      resolution: entity.resolution,
      resolvedAt: entity.resolvedAt?.toISOString() ?? null,
      closedAt: entity.closedAt?.toISOString() ?? null,
      reopenCount: analysis.reopenCount,
      sla: {
        responseMinutes: entity.slaResponseMinutes,
        resolutionMinutes: entity.slaResolutionMinutes,
        responseStatus: analysis.firstResponse.status,
        resolutionStatus: cycle?.status ?? 'running',
        responseDueAt: analysis.firstResponse.dueAt.toISOString(),
        resolutionDueAt: cycle?.dueAt?.toISOString() ?? null,
      },
      nextStatuses: this.history.nextStatuses(entity, RequestContext.currentUser(), now),
      createdAt: entity.createdAt.toISOString(),
    });
  }
}
