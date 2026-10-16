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
  ACCOUNT_SECURITY: { path: '/profile', query: { tab: 'security' } },
};

/** Cuántas pendientes muestra la bandeja (el historial completo vive en Mi perfil → Notificaciones). */
export const INBOX_LIMIT = 5;

/** Cada cuánto se consulta si hay notificaciones nuevas (el backend no tiene tiempo real). */
export const INBOX_POLL_MS = 60_000;

/**
 * Avisos sobre un ticket que abren su HILO (`/my-tickets?ticket=<uuid>`): lo que llega al solicitante y al equipo
 * (asignación, cambios, comentarios, reapertura, encuesta baja). El hilo es la misma pantalla para ambos.
 */
export const TICKET_THREAD_TYPES: ReadonlySet<TNotification['type']> = new Set([
  'TICKET_STATUS_CHANGED',
  'TICKET_COMMENTED',
  'TICKET_ASSIGNED',
  'TICKET_CHANGED_BY_ALTERNANTE',
  'TICKET_REOPENED',
  'TICKET_SURVEY_ALERT',
]);
