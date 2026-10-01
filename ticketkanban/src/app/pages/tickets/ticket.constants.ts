import type { TTicketCategory, TTicketPriority, TTicketStatus } from './ticket.types';

/** Etiquetas de los enums del contrato (tablas de lookup reutilizables → archivo propio). */
export const TICKET_STATUS_LABELS: Record<TTicketStatus, string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  done: 'Hecho',
};

export const TICKET_PRIORITY_LABELS: Record<TTicketPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
};

export const TICKET_CATEGORY_LABELS: Record<TTicketCategory, string> = {
  bug: 'Error',
  feature: 'Funcionalidad',
  support: 'Soporte',
  other: 'Otra',
};

/** Severidad de `p-tag` por prioridad (el texto acompaña siempre: el color no es la única señal). */
export const TICKET_PRIORITY_SEVERITY: Record<
  TTicketPriority,
  'secondary' | 'info' | 'warn' | 'danger'
> = {
  low: 'secondary',
  medium: 'info',
  high: 'warn',
  critical: 'danger',
};
