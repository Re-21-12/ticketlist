import type { IBadgeMeta } from '../../shared/ui/badge/badge.types';
import type { IPeriodPreset } from './metrics.interface';
import type { TMetricStatus } from './metrics.types';

/** Semáforo: el TEXTO y el ícono acompañan siempre al color (WCAG 1.4.1). */
export const METRIC_STATUS_META: Record<TMetricStatus, IBadgeMeta> = {
  ok: { label: 'Cumple', icon: 'pi-check-circle', severity: 'success' },
  warning: { label: 'En riesgo', icon: 'pi-exclamation-triangle', severity: 'warn' },
  critical: { label: 'No cumple', icon: 'pi-times-circle', severity: 'danger' },
  'no-data': { label: 'Sin información', icon: 'pi-minus-circle', severity: 'secondary' },
};

export const PERIOD_PRESETS: readonly IPeriodPreset[] = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];
export const DEFAULT_PERIOD_DAYS = 30;

/** Texto cuando un indicador no tiene muestra (flujo alterno A1 de CU05). */
export const NO_DATA_TEXT = 'Sin información';

/** Etiqueta del estado del plazo de resolución de un ticket (flujo alterno A2: «Fuera de SLA»). */
export const RESOLUTION_STATUS_META: Record<string, IBadgeMeta> = {
  running: { label: 'En plazo', icon: 'pi-clock', severity: 'success' },
  paused: { label: 'SLA en pausa', icon: 'pi-pause', severity: 'secondary' },
  escalated: { label: 'Escalado', icon: 'pi-angle-double-up', severity: 'warn' },
  met: { label: 'SLA cumplido', icon: 'pi-check', severity: 'success' },
  breached: { label: 'Fuera de SLA', icon: 'pi-exclamation-circle', severity: 'danger' },
};
