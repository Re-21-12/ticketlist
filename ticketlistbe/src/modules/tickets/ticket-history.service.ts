import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../../core/context/request-context.js';
import { EUserRole } from '../auth/casl/ability.enum.js';
import type { ISessionUser } from '../auth/session/session-user.interface.js';
import { UsersRepository } from '../users/users.repository.js';
import type { ITicketEvent, IAttachmentRef } from './events/ticket-event.entity.js';
import { TicketEventsRepository } from './events/ticket-events.repository.js';
import {
  allowedTargets,
  REOPEN_WINDOW_DAYS,
  type TTicketStatus,
  type TTransitionActor,
} from './lifecycle/ticket-lifecycle.js';
import { DEFAULT_CALENDAR } from './sla/business-calendar.js';
import { analyzeTicket, type ITicketAnalysis, type TTicketEventType } from './sla/ticket-analysis.js';
import type { TicketEntity } from './ticket.entity.js';

const DAY_MS = 24 * 60 * 60_000;
/** Roles que ven las notas internas del equipo (el auditor, en solo lectura). */
const STAFF_ROLES: readonly EUserRole[] = [EUserRole.ADMIN, EUserRole.SUPERVISOR, EUserRole.AGENT, EUserRole.AUDITOR];

export interface INewEvent {
  ticket: TicketEntity;
  type: TTicketEventType;
  actor: 'customer' | 'staff' | 'system';
  /** Quién lo hizo; por defecto la persona de la sesión. */
  actorUser?: ISessionUser | null;
  visibility?: 'public' | 'internal';
  from?: TTicketStatus | null;
  to?: TTicketStatus;
  by?: 'customer' | 'system';
  body?: string | null;
  attachments?: IAttachmentRef[];
  assignee?: string | null;
  status?: TTicketStatus;
  at?: Date;
}

/**
 * Escribe y consulta el HISTORIAL de un ticket (docs/standard/metrics.md §2) y decide quién es quién
 * respecto a él (solicitante o equipo). Lo comparten el CRUD (`TicketsService`) y el ciclo de vida
 * (`TicketLifecycleService`) para que ambos dejen el mismo rastro.
 */
@Injectable()
export class TicketHistoryService {
  constructor(
    private readonly events: TicketEventsRepository,
    private readonly usersRepository: UsersRepository,
  ) {}

  record(input: INewEvent): void {
    const user = input.actorUser === undefined ? RequestContext.currentUser() : input.actorUser;
    this.events.append({
      uuid: randomUUID(),
      ticketUuid: input.ticket.uuid,
      type: input.type,
      at: input.at ?? new Date(),
      actor: input.actor,
      actorUuid: user?.uuid ?? null,
      actorName: input.actor === 'system' ? 'Sistema' : (user?.name ?? 'Sistema'),
      visibility: input.visibility ?? 'public',
      from: input.from ?? null,
      ...(input.to ? { to: input.to } : {}),
      ...(input.by ? { by: input.by } : {}),
      body: input.body ?? null,
      attachments: input.attachments ?? [],
      assignee: input.assignee ?? null,
      ...(input.status ? { status: input.status } : {}),
    });
  }

  eventsOf(ticketUuid: string): ITicketEvent[] {
    return this.events.listByTicket(ticketUuid);
  }

  analyze(ticket: TicketEntity, now = new Date()): ITicketAnalysis {
    return analyzeTicket({
      createdAt: ticket.createdAt,
      events: this.events.listByTicket(ticket.uuid),
      policy: { responseMinutes: ticket.slaResponseMinutes, resolutionMinutes: ticket.slaResolutionMinutes },
      now,
      calendar: DEFAULT_CALENDAR,
    });
  }

  /**
   * Qué papel juega esta persona RESPECTO a este ticket: solicitante y/o su rol de equipo (puede ser ambos).
   * ADMIN y SUPERVISOR actúan sobre cualquiera; un AGENTE, solo sobre lo que tiene asignado; el AUDITOR
   * y el cliente ajeno no actúan.
   */
  actorsFor(ticket: TicketEntity, user: ISessionUser | null): Set<TTransitionActor> {
    const actors = new Set<TTransitionActor>();
    if (!user) return actors;
    if (user.uuid === ticket.ownerUuid) actors.add('customer');
    if (user.role === EUserRole.ADMIN) actors.add('admin');
    if (user.role === EUserRole.SUPERVISOR) actors.add('supervisor');
    if (user.role === EUserRole.AGENT && !!ticket.assigneeEmail && ticket.assigneeEmail === user.email) actors.add('agent');
    return actors;
  }

  /** ¿Interviene como equipo (atiende, escala, administra) en este ticket? */
  isTeamFor(ticket: TicketEntity, user: ISessionUser | null): boolean {
    return [...this.actorsFor(ticket, user)].some((actor) => actor === 'agent' || actor === 'supervisor' || actor === 'admin');
  }

  /** Quien ve las notas internas: todo el equipo y el auditor (solo lectura). */
  isTeamMember(user: ISessionUser | null): boolean {
    return !!user && STAFF_ROLES.includes(user.role);
  }

  /** Estados a los que ESTA persona puede mover el ticket ahora (arma los botones). */
  nextStatuses(ticket: TicketEntity, user: ISessionUser | null, now = new Date()): TTicketStatus[] {
    const targets = new Set<TTicketStatus>();
    for (const actor of this.actorsFor(ticket, user)) {
      for (const target of allowedTargets(ticket.status, actor)) targets.add(target);
    }
    // Un cerrado solo se reabre dentro de la ventana de reincidencia.
    if (ticket.status === 'closed' && !this.withinReopenWindow(ticket, now)) targets.delete('reopened');
    return [...targets];
  }

  withinReopenWindow(ticket: TicketEntity, now: Date): boolean {
    return !!ticket.closedAt && now.getTime() - ticket.closedAt.getTime() <= REOPEN_WINDOW_DAYS * DAY_MS;
  }

  nameOf(email: string): string | null {
    if (!email) return null;
    return this.usersRepository.findByEmail(email)?.name ?? email;
  }
}
