import type { IBadgeMeta } from '../../shared/ui/badge/badge.types';
import type { TTicketEventType } from './my-tickets.types';

/** Ícono y título de cada tipo de renglón del historial (el texto siempre acompaña: el ícono es refuerzo). */
export const TICKET_EVENT_META: Record<TTicketEventType, { icon: string; title: string }> = {
  CREATED: { icon: 'pi-plus-circle', title: 'Ticket registrado' },
  ASSIGNED: { icon: 'pi-user-plus', title: 'Asignado a una persona del equipo' },
  STATUS_CHANGED: { icon: 'pi-sync', title: 'Cambió el estado' },
  COMMENT_PUBLIC: { icon: 'pi-comment', title: 'Comentario' },
  COMMENT_INTERNAL: { icon: 'pi-lock', title: 'Nota interna del equipo' },
  SURVEY_SENT: { icon: 'pi-star', title: 'Encuesta de satisfacción enviada' },
  SURVEY_ANSWERED: { icon: 'pi-star-fill', title: 'Encuesta respondida' },
  NOTIFIED: { icon: 'pi-bell', title: 'Se te notificó' },
};

/** Estado de la conexión en tiempo real tal como se muestra (con ícono y texto, nunca solo color). */
export const SYNC_STATE_META: Record<'live' | 'connecting' | 'offline' | 'idle', IBadgeMeta> = {
  live: { label: 'En vivo', icon: 'pi-wifi', severity: 'success' },
  connecting: { label: 'Conectando…', icon: 'pi-spin pi-spinner', severity: 'secondary' },
  offline: { label: 'Sin conexión en vivo', icon: 'pi-exclamation-triangle', severity: 'warn' },
  idle: { label: 'Sin conexión en vivo', icon: 'pi-exclamation-triangle', severity: 'warn' },
};

/** Máximo de tickets propios que trae la pantalla (el backend pagina; un solicitante rara vez pasa de unas decenas). */
export const MY_TICKETS_TAKE = 50;
