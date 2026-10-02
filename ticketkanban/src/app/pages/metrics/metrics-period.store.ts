import { computed, Service, signal } from '@angular/core';
import { DEFAULT_PERIOD_DAYS } from './metrics.constants';
import { toIsoDay } from './metrics.format';
import type { IMetricsPeriod } from './metrics.interface';

const DAY_MS = 86_400_000;
/** Mismo tope que `MAX_PERIOD_DAYS` del backend. */
const MAX_PERIOD_DAYS = 366;

/** Rango que cubre los últimos `days` días, hasta hoy (hora local). */
export function periodOfLastDays(days: number, now: Date = new Date()): IMetricsPeriod {
  return { from: toIsoDay(new Date(now.getTime() - (days - 1) * DAY_MS)), to: toIsoDay(now) };
}

/**
 * Período que consultan «Métricas del equipo» y «Mis métricas» (comparten el mismo, así al pasar de una pantalla a
 * la otra se sigue mirando el mismo rango). Valida igual que el backend: `from` ≤ `to` y como máximo 366 días.
 */
@Service()
export class MetricsPeriodStore {
  private readonly $_period = signal<IMetricsPeriod>(periodOfLastDays(DEFAULT_PERIOD_DAYS));
  private readonly $_presetDays = signal<number | null>(DEFAULT_PERIOD_DAYS);
  private readonly $_error = signal<string | null>(null);

  readonly $period = this.$_period.asReadonly();
  /** Días del preajuste activo; `null` si el rango es personalizado. */
  readonly $presetDays = this.$_presetDays.asReadonly();
  readonly $error = this.$_error.asReadonly();
  readonly $query = computed(() => ({ from: this.$_period().from, to: this.$_period().to }));

  setPreset(days: number): void {
    this.$_period.set(periodOfLastDays(days));
    this.$_presetDays.set(days);
    this.$_error.set(null);
  }

  /** Rango personalizado. Devuelve `false` (y deja el período anterior) si no es válido. */
  setRange(from: string, to: string): boolean {
    if (!from || !to) {
      this.$_error.set('Indica la fecha inicial y la final.');
      return false;
    }
    if (from > to) {
      this.$_error.set('La fecha inicial no puede ser posterior a la final.');
      return false;
    }
    const days = (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
    if (days > MAX_PERIOD_DAYS) {
      this.$_error.set(`El período no puede superar ${MAX_PERIOD_DAYS} días.`);
      return false;
    }
    this.$_period.set({ from, to });
    this.$_presetDays.set(null);
    this.$_error.set(null);
    return true;
  }
}
