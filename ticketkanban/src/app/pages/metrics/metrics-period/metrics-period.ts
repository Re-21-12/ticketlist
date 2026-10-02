import { Component, computed, effect, inject, signal } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MetricsPeriodStore } from '../metrics-period.store';
import { PERIOD_PRESETS } from '../metrics.constants';

/**
 * Selector del período de las métricas: preajustes (7/30/90 días) o un rango de fechas. Valida antes de consultar
 * (inicial ≤ final, máximo 366 días) y avisa con un mensaje que lee el lector de pantalla.
 */
@Component({
  selector: 'app-metrics-period',
  imports: [ButtonModule],
  templateUrl: './metrics-period.html',
  styleUrl: './metrics-period.css',
})
export class MetricsPeriod {
  protected readonly _store = inject(MetricsPeriodStore);
  protected readonly presets = PERIOD_PRESETS;

  protected readonly $from = signal(this._store.$period().from);
  protected readonly $to = signal(this._store.$period().to);
  protected readonly $dirty = computed(() => this.$from() !== this._store.$period().from || this.$to() !== this._store.$period().to);

  constructor() {
    // Un preajuste (o cambiar de pantalla) mueve el rango: los campos lo siguen.
    effect(() => {
      const period = this._store.$period();
      this.$from.set(period.from);
      this.$to.set(period.to);
    });
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected apply(): void {
    this._store.setRange(this.$from(), this.$to());
  }
}
