import { EUserRole } from '../casl/ability.enum';
import type { TTicketStatus } from '../../pages/tickets/ticket.types';

/**
 * Espejo de `lifecycle/ticket-lifecycle.ts` del backend para que el mock responda lo mismo (quién puede mover
 * un ticket a qué estado). Roles distintos, poderes distintos: el agente atiende y resuelve lo asignado, el
 * supervisor asigna, escala y pide información (no resuelve), el administrador hace todo, el cliente confirma
 * o reabre lo suyo y el auditor no mueve nada. Si cambia allá, cambia aquí: lo vigila el test del mock.
 */
export type TMockActor = 'agent' | 'supervisor' | 'admin' | 'customer' | 'system';

const TEAM: readonly TMockActor[] = ['agent', 'supervisor', 'admin'];
const WORK: readonly TMockActor[] = ['agent', 'admin'];
const ESCALATE: readonly TMockActor[] = ['supervisor', 'admin'];

export const MOCK_TRANSITIONS: Record<TTicketStatus, Partial<Record<TTicketStatus, readonly TMockActor[]>>> = {
  new: { assigned: TEAM, in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE },
  assigned: { in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
  in_progress: { pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
  pending_customer: { in_progress: ['agent', 'admin', 'system'], escalated: ESCALATE, resolved: WORK },
  escalated: { in_progress: TEAM, resolved: WORK },
  resolved: { closed: ['customer', 'system'], reopened: ['customer', 'agent', 'admin'] },
  closed: { reopened: ['customer', 'agent', 'admin'] },
  reopened: { assigned: ['supervisor', 'admin'], in_progress: WORK, pending_customer: TEAM, escalated: ESCALATE, resolved: WORK },
};

export const REOPEN_WINDOW_MS = 7 * 86_400_000;

export interface IMockViewer {
  uuid: string;
  email: string;
  role: EUserRole;
}

export interface IMockLifecycleTicket {
  ownerUuid: string;
  assigneeEmail: string;
  status: TTicketStatus;
  closedAt: string | null;
}

/** Quién es esta persona respecto al ticket: solicitante y/o su papel de equipo (el agente, solo en lo asignado). */
export function mockActorsFor(ticket: IMockLifecycleTicket, viewer: IMockViewer | null): Set<TMockActor> {
  const actors = new Set<TMockActor>();
  if (!viewer) return actors;
  if (viewer.uuid === ticket.ownerUuid) actors.add('customer');
  if (viewer.role === EUserRole.ADMIN) actors.add('admin');
  if (viewer.role === EUserRole.SUPERVISOR) actors.add('supervisor');
  if (viewer.role === EUserRole.AGENT && !!ticket.assigneeEmail && ticket.assigneeEmail === viewer.email) actors.add('agent');
  return actors;
}

/** ¿Interviene como equipo (atiende, escala, administra) en este ticket? */
export function mockIsTeamFor(ticket: IMockLifecycleTicket, viewer: IMockViewer | null): boolean {
  return [...mockActorsFor(ticket, viewer)].some((actor) => actor === 'agent' || actor === 'supervisor' || actor === 'admin');
}

export function mockNextStatuses(ticket: IMockLifecycleTicket, viewer: IMockViewer | null, now = Date.now()): TTicketStatus[] {
  const targets = new Set<TTicketStatus>();
  for (const actor of mockActorsFor(ticket, viewer)) {
    for (const [to, actors] of Object.entries(MOCK_TRANSITIONS[ticket.status]) as [TTicketStatus, readonly TMockActor[]][]) {
      if (actors.includes(actor)) targets.add(to);
    }
  }
  if (ticket.status === 'closed' && (!ticket.closedAt || now - new Date(ticket.closedAt).getTime() > REOPEN_WINDOW_MS)) {
    targets.delete('reopened');
  }
  return [...targets];
}
