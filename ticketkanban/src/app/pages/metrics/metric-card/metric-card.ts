import { Component, computed, input } from '@angular/core';
import { Badge } from '../../../shared/ui/badge/badge';
import { METRIC_STATUS_META } from '../metrics.constants';
import type { IMetricCard } from '../metrics.interface';

/**
 * Tarjeta de un indicador: valor grande + semáforo + meta + tamaño de muestra. El semáforo es una insignia con
 * TEXTO e ícono (nunca solo color); el borde de color es refuerzo.
 */
@Component({
  selector: 'app-metric-card',
  imports: [Badge],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.css',
  host: { '[attr.data-status]': '$card().status' },
})
export class MetricCard {
  readonly $card = input.required<IMetricCard>();
  protected readonly $status = computed(() => METRIC_STATUS_META[this.$card().status]);
}
