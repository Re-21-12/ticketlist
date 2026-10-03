import type { TTicketStatus } from '../../pages/tickets/ticket.types';

/** Un renglón del historial del ticket (espejo de `ITicketEvent` del backend, ya en forma de respuesta). */
export interface IMockEvent {
  uuid: string;
  ticketUuid: string;
  type: 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'COMMENT_PUBLIC' | 'COMMENT_INTERNAL' | 'SURVEY_SENT' | 'SURVEY_ANSWERED' | 'NOTIFIED';
  at: string;
  visibility: 'public' | 'internal';
  actor: 'customer' | 'staff' | 'system';
  actorName: string;
  from: TTicketStatus | null;
  to: TTicketStatus | null;
  body: string | null;
  attachments: never[];
  assignee: string | null;
}

/**
 * Qué se le dice al SOLICITANTE al cambiar el estado de su ticket (mismos textos que `notifyAboutStatus` del backend).
 * `null` = ese cambio no le avisa. `teamActor`: quien lo hizo es del equipo (el solicitante no se avisa a sí mismo).
 */
export function requesterMessage(code: string, to: TTicketStatus, options: { teamActor: boolean; system: boolean }): string | null {
  switch (to) {
    case 'in_progress':
      return options.teamActor ? `${code} está en atención` : null;
    case 'pending_customer':
      return `${code}: necesitamos más información de tu parte`;
    case 'escalated':
      return `${code} fue escalado a un nivel superior`;
    case 'resolved':
      return `${code} fue resuelto: revisa la solución y confirma el cierre`;
    case 'closed':
      return options.system ? `${code} se cerró automáticamente tras 48 h sin respuesta` : null;
    case 'reopened':
      return options.teamActor ? `${code} se reabrió` : null;
    default:
      return null;
  }
}
