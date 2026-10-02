/**
 * Plazos de SLA por criticidad (docs/standard/metrics.md §3.2). Los valores son MINUTOS HÁBILES
 * (ver `business-calendar.ts`). Cada ticket guarda el plazo vigente AL CREARSE: cambiar la política no
 * reescribe el pasado.
 */
export interface ISlaPolicy {
  /** Tiempo máximo hasta la primera respuesta humana. */
  readonly responseMinutes: number;
  /** Tiempo máximo hasta «Resuelto». */
  readonly resolutionMinutes: number;
}

const HOUR = 60;

/** Respuesta inicial: < 2 h para todos (requerimiento). */
const RESPONSE_MINUTES = 2 * HOUR;

export const DEFAULT_SLA_BY_PRIORITY: Record<'critical' | 'high' | 'medium' | 'low', ISlaPolicy> = {
  // Crítico / bloqueante (sistema caído): < 2 h.
  critical: { responseMinutes: RESPONSE_MINUTES, resolutionMinutes: 2 * HOUR },
  // Medio / operativo (falla parcial): < 8 h o dentro del mismo día hábil.
  high: { responseMinutes: RESPONSE_MINUTES, resolutionMinutes: 8 * HOUR },
  medium: { responseMinutes: RESPONSE_MINUTES, resolutionMinutes: 8 * HOUR },
  // Bajo / consultas: < 24 h.
  low: { responseMinutes: RESPONSE_MINUTES, resolutionMinutes: 24 * HOUR },
};

/** Las mejoras (tipo `improvement`) de prioridad baja tienen hasta 48 h (el requerimiento dice 24 a 48 h). */
export const IMPROVEMENT_RESOLUTION_MINUTES = 48 * HOUR;

export function policyFor(
  priority: keyof typeof DEFAULT_SLA_BY_PRIORITY,
  type: string,
  table: Record<keyof typeof DEFAULT_SLA_BY_PRIORITY, ISlaPolicy> = DEFAULT_SLA_BY_PRIORITY,
): ISlaPolicy {
  const base = table[priority];
  return priority === 'low' && type === 'improvement'
    ? { ...base, resolutionMinutes: Math.max(base.resolutionMinutes, IMPROVEMENT_RESOLUTION_MINUTES) }
    : base;
}
