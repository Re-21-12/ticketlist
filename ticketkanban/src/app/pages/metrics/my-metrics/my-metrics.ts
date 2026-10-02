import { Component, computed, inject } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { mapResourceState, type TAsyncState } from '../../../core/interfaces/async-state.types';
import { Illustration } from '../../../shared/ui/illustration/illustration';
import { MetricSummary } from '../metric-summary/metric-summary';
import { MetricTickets } from '../metric-tickets/metric-tickets';
import { MetricsPeriod } from '../metrics-period/metrics-period';
import type { TAgentDetail } from '../metrics.types';
import { MyMetricsService } from './my-metrics.service';

/**
 * «Mis métricas»: lo mismo que ve el supervisor de una persona, pero solo de quien consulta (un agente nunca ve las
 * de sus compañeros). Para coaching propio: tickets gestionados, SLA, primer contacto y satisfacción.
 */
@Component({
  selector: 'app-my-metrics',
  imports: [ButtonModule, Illustration, MetricsPeriod, MetricSummary, MetricTickets],
  templateUrl: './my-metrics.html',
  styleUrl: './my-metrics.css',
})
export class MyMetrics {
  protected readonly _service = inject(MyMetricsService);

  protected readonly $state = computed<TAsyncState<TAgentDetail>>(() =>
    mapResourceState(this._service.me.status(), this._service.me.value(), this._service.me.error()),
  );

  protected reload(): void {
    this._service.me.reload();
  }
}
