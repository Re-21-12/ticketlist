import type { IBadgeMeta } from '../../shared/ui/badge/badge.types';
import type { TTicketCategory, TTicketComplexity, TTicketPriority, TTicketStatus, TTicketType } from './ticket.types';

/**
 * Etiqueta, ícono y color de cada valor de los enums del contrato. Es el RESPALDO: lo que ve la persona sale
 * de los catálogos (editables por un administrador en «Catálogos»); esto solo cubre mientras cargan o si
 * fallan. El texto siempre acompaña al color y al ícono.
 */
export const TICKET_STATUS_META: Record<TTicketStatus, IBadgeMeta> = {
  new: { label: 'Nuevo', icon: 'pi-inbox', severity: 'info' },
  assigned: { label: 'Asignado', icon: 'pi-user-plus', severity: 'info' },
  in_progress: { label: 'En atención', icon: 'pi-clock', severity: 'warn' },
  pending_customer: { label: 'Pendiente del cliente', icon: 'pi-hourglass', severity: 'secondary' },
  escalated: { label: 'Escalado (N2/N3)', icon: 'pi-angle-double-up', severity: 'danger' },
  resolved: { label: 'Resuelto', icon: 'pi-check', severity: 'success' },
  closed: { label: 'Cerrado', icon: 'pi-lock', severity: 'contrast' },
  reopened: { label: 'Reabierto', icon: 'pi-replay', severity: 'warn' },
};

export const TICKET_PRIORITY_META: Record<TTicketPriority, IBadgeMeta> = {
  low: { label: 'Baja', icon: 'pi-angle-down', severity: 'secondary' },
  medium: { label: 'Media', icon: 'pi-minus', severity: 'info' },
  high: { label: 'Alta', icon: 'pi-angle-up', severity: 'warn' },
  critical: { label: 'Crítica', icon: 'pi-exclamation-triangle', severity: 'danger' },
};

export const TICKET_TYPE_META: Record<TTicketType, IBadgeMeta> = {
  incident: { label: 'Incidente', icon: 'pi-bolt', severity: 'danger' },
  service_request: { label: 'Solicitud de servicio', icon: 'pi-briefcase', severity: 'info' },
  inquiry: { label: 'Consulta', icon: 'pi-question-circle', severity: 'secondary' },
  improvement: { label: 'Mejora', icon: 'pi-lightbulb', severity: 'success' },
};

export const TICKET_CATEGORY_META: Record<TTicketCategory, IBadgeMeta> = {
  hardware: { label: 'Hardware', icon: 'pi-desktop', severity: 'secondary' },
  software: { label: 'Software', icon: 'pi-code', severity: 'info' },
  network: { label: 'Red y conectividad', icon: 'pi-wifi', severity: 'info' },
  access: { label: 'Accesos y cuentas', icon: 'pi-key', severity: 'warn' },
  email: { label: 'Correo', icon: 'pi-envelope', severity: 'secondary' },
  other: { label: 'Otra', icon: 'pi-ellipsis-h', severity: 'contrast' },
};

/**
 * Los departamentos los administra la organización (catálogo `ticket-department`): NO hay una lista fija. Solo `it`
 * (solicitud interna del propio equipo de TI) es de sistema y sirve de respaldo si el catálogo no responde.
 */
export const DEFAULT_DEPARTMENT = 'it';
export const TICKET_DEPARTMENT_FALLBACK: IBadgeMeta & { value: string } = { value: 'it', label: 'TI (interno)', icon: 'pi-desktop', severity: 'contrast' };

export const TICKET_COMPLEXITY_META: Record<TTicketComplexity, IBadgeMeta> = {
  simple: { label: 'Simple', icon: 'pi-circle', severity: 'success' },
  moderate: { label: 'Moderada', icon: 'pi-circle-fill', severity: 'warn' },
  complex: { label: 'Compleja', icon: 'pi-sitemap', severity: 'danger' },
};

const labelsOf = <T extends string>(meta: Record<T, IBadgeMeta>): Record<T, string> =>
  Object.fromEntries(Object.entries<IBadgeMeta>(meta).map(([key, value]) => [key, value.label])) as Record<T, string>;

export const TICKET_STATUS_LABELS = labelsOf(TICKET_STATUS_META);
export const TICKET_PRIORITY_LABELS = labelsOf(TICKET_PRIORITY_META);
export const TICKET_TYPE_LABELS = labelsOf(TICKET_TYPE_META);
export const TICKET_CATEGORY_LABELS = labelsOf(TICKET_CATEGORY_META);
export const TICKET_COMPLEXITY_LABELS = labelsOf(TICKET_COMPLEXITY_META);

/** Etiqueta de cada columna del tablero (los estados son variaciones de estos tres). */
export const TICKET_GROUP_LABELS = { new: 'Nuevo', in_attention: 'En atención', closed: 'Cerrado' } as const;

/**
 * Rangos de SLA por urgencia (espejo de `sla/sla-policy.ts` del backend; minutos HÁBILES: L–V 8:00–17:00, UTC−6).
 * Es solo la REFERENCIA que se le muestra a la persona; los plazos de cada ticket los calcula el backend (`ticket.sla`).
 */
export const SLA_RANGES: readonly { priority: TTicketPriority; response: string; resolution: string; example: string }[] = [
  { priority: 'critical', response: '< 2 h', resolution: '< 2 h', example: 'Sistema caído o bloqueante' },
  { priority: 'high', response: '< 2 h', resolution: '< 8 h', example: 'Falla parcial: se resuelve el mismo día hábil' },
  { priority: 'medium', response: '< 2 h', resolution: '< 8 h', example: 'Operativo: afecta el trabajo pero hay alternativa' },
  { priority: 'low', response: '< 2 h', resolution: '< 24 h', example: 'Consultas · las mejoras tienen hasta 48 h' },
];

/** Metas de servicio que se miden con esos plazos (docs/standard/metrics.md). */
export const SERVICE_TARGETS: readonly { icon: string; label: string; value: string }[] = [
  { icon: 'pi-verified', label: 'Cumplimiento del SLA', value: '> 95 %' },
  { icon: 'pi-check-circle', label: 'Resolución en el primer contacto', value: '> 75–80 %' },
  { icon: 'pi-star', label: 'Satisfacción (CSAT, 1–5)', value: '≥ 4.5' },
];

/** Cómo se muestra el estado del plazo de resolución de un ticket (el texto acompaña siempre al color). */
export const SLA_STATE_META: Record<string, IBadgeMeta> = {
  running: { label: 'En plazo', icon: 'pi-clock', severity: 'success' },
  paused: { label: 'SLA en pausa', icon: 'pi-pause', severity: 'secondary' },
  escalated: { label: 'SLA escalado', icon: 'pi-angle-double-up', severity: 'warn' },
  met: { label: 'SLA cumplido', icon: 'pi-check', severity: 'success' },
  breached: { label: 'Fuera de SLA', icon: 'pi-exclamation-circle', severity: 'danger' },
};
