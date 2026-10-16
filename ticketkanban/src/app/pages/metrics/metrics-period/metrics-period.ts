import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { MetricsPeriodStore } from '../metrics-period.store';
import { PERIOD_PRESETS } from '../metrics.constants';
import { toIsoDay } from '../metrics.format';

/**
 * Selector del período de las métricas: preajustes (7/30/90 días) o un rango de fechas. Valida antes de consultar
 * (inicial ≤ final, máximo 366 días) y avisa con un mensaje que lee el lector de pantalla.
 *
 * El rango usa `p-datepicker` de optimus-ui (no `<input type="date">` nativo): el nativo no se puede
 * estilizar y quedaba con otra altura que los botones — la incongruencia que pidió corregir. El
 * calendario va pegado al campo (`iconDisplay="input"`), el panel al `body` (el contenedor tiene
 * `overflow`) y el input es de solo lectura: la fecha se elige en el calendario, no escribiéndola.
 */
@Component({
  selector: 'app-metrics-period',
  imports: [ButtonModule, DatePickerModule, FormsModule],
  templateUrl: './metrics-period.html',
  styleUrl: './metrics-period.css',
})
export class MetricsPeriod {
  protected readonly _store = inject(MetricsPeriodStore);
  protected readonly presets = PERIOD_PRESETS;

  /** `Date | null` de optimus-ui; se mantiene como ISO (el contrato de las métricas es ISO). */
  protected readonly $from = signal<Date | null>(this.asDate(this._store.$period().from));
  protected readonly $to = signal<Date | null>(this.asDate(this._store.$period().to));
  protected readonly $dirty = computed(
    () => this.toIso(this.$from()) !== this._store.$period().from || this.toIso(this.$to()) !== this._store.$period().to,
  );

  /** El calendario de «Desde» no deja pasar del «Hasta» elegido, y al revés. */
  protected readonly $maxFrom = computed(() => this.$to());
  protected readonly $minTo = computed(() => this.$from());

  constructor() {
    // Un preajuste (o cambiar de pantalla) mueve el rango: los campos lo siguen.
    effect(() => {
      const period = this._store.$period();
      this.$from.set(this.asDate(period.from));
      this.$to.set(this.asDate(period.to));
    });
  }

  protected apply(): void {
    const from = this.toIso(this.$from());
    const to = this.toIso(this.$to());
    if (from && to) this._store.setRange(from, to);
  }

  /** `'YYYY-MM-DD'` → `Date` local (sin corrimiento por UTC, que es lo que rompe los `new Date('…')`). */
  private asDate(iso: string): Date | null {
    if (!iso) return null;
    const [year, month, day] = iso.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private toIso(date: Date | null): string {
    return date ? toIsoDay(date) : '';
  }
}