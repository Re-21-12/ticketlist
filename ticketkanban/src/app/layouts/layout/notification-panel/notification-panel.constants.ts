import type { TNotification } from '../../../pages/profile/profile.types';

/**
 * Pantalla a la que lleva cada tipo de notificación al abrirla desde la bandeja del topbar. `TICKET_SURVEY` va a
 * la pestaña de notificaciones del perfil (ahí está el botón «Calificar»); `ACCOUNT_LOCKED` a «Usuarios».
 */
export const NOTIFICATION_ROUTES: Record<TNotification['type'], { path: string; query?: Record<string, string> }> = {
  TICKET_ASSIGNED: { path: '/tickets' },
  TICKET_CHANGED_BY_ALTERNANTE: { path: '/tickets' },
  TICKET_STATUS_CHANGED: { path: '/my-tickets' },
  TICKET_COMMENTED: { path: '/my-tickets' },
  TICKET_REOPENED: { path: '/tickets' },
  TICKET_SURVEY_ALERT: { path: '/tickets' },
  TICKET_SURVEY: { path: '/profile', query: { tab: 'notifications' } },
  RELATIONSHIP_GRANTED: { path: '/sharing' },
  RELATIONSHIP_REVOKED: { path: '/sharing' },
  ACCOUNT_LOCKED: { path: '/users' },
};

/** Cuántas pendientes muestra la bandeja (el historial completo vive en Mi perfil → Notificaciones). */
export const INBOX_LIMIT = 5;

/** Cada cuánto se consulta si hay notificaciones nuevas (el backend no tiene tiempo real). */
export const INBOX_POLL_MS = 60_000;

/**
 * Avisos que le llegan al SOLICITANTE (CU01): abren «Mis tickets» con ese ticket elegido (`?ticket=<uuid>`). Quien
 * es del equipo recibe los mismos tipos como responsable, y para él el ticket vive en el tablero.
 */
export const REQUESTER_TICKET_TYPES: ReadonlySet<TNotification['type']> = new Set(['TICKET_STATUS_CHANGED', 'TICKET_COMMENTED']);
