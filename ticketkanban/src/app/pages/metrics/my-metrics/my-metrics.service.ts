import { httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { MetricsPeriodStore } from '../metrics-period.store';
import { AgentDetailResponseSchema } from '../metrics.schema';

/** `GET /api/metrics/me`: las métricas de quien consulta (cada agente ve SOLO las suyas). */
@Service()
export class MyMetricsService {
  private readonly _period = inject(MetricsPeriodStore);

  readonly me = httpResource(() => ({ url: '/api/metrics/me', params: this._period.$query() }), {
    parse: (raw) => AgentDetailResponseSchema.parse(raw),
  });
}
