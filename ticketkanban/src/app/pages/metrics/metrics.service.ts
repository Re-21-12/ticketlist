import { httpResource } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { MetricsPeriodStore } from './metrics-period.store';
import { AgentDetailResponseSchema, AgentsResponseSchema, ProblemsResponseSchema, SummaryResponseSchema } from './metrics.schema';

/**
 * Acceso HTTP de «Métricas del equipo» (`/api/metrics/*`, solo lectura): transporte + validación Zod. Las
 * fórmulas viven en el backend (una sola vez, `metrics-engine.ts`); aquí NADA se recalcula.
 */
@Service()
export class MetricsService {
  private readonly _period = inject(MetricsPeriodStore);
  /** Colaborador cuyo detalle se consulta; `undefined` deja ese resource en idle. */
  private readonly $_agentEmail = signal<string | undefined>(undefined);
  readonly $agentEmail = this.$_agentEmail.asReadonly();

  readonly summary = httpResource(() => ({ url: '/api/metrics/summary', params: this._period.$query() }), {
    parse: (raw) => SummaryResponseSchema.parse(raw),
  });

  readonly agents = httpResource(() => ({ url: '/api/metrics/agents', params: this._period.$query() }), {
    parse: (raw) => AgentsResponseSchema.parse(raw),
  });

  readonly problems = httpResource(() => ({ url: '/api/metrics/problems', params: this._period.$query() }), {
    parse: (raw) => ProblemsResponseSchema.parse(raw),
  });

  readonly agentDetail = httpResource(
    () => {
      const email = this.$_agentEmail();
      return email ? { url: `/api/metrics/agents/${encodeURIComponent(email)}`, params: this._period.$query() } : undefined;
    },
    { parse: (raw) => AgentDetailResponseSchema.parse(raw) },
  );

  selectAgent(email: string | undefined): void {
    this.$_agentEmail.set(email);
  }

  reload(): void {
    this.summary.reload();
    this.agents.reload();
    this.problems.reload();
    this.agentDetail.reload();
  }
}
