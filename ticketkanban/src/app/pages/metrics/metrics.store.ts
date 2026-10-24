import { computed, inject, Service } from '@angular/core';
import { mapResource, type TAsyncState } from '../../core/interfaces/async-state.types';
import { MetricsService } from './metrics.service';
import type { TAgentDetail, TAgentsResponse, TProblems, TSummaryResponse } from './metrics.types';

/** Estado de pantalla de «Métricas del equipo»: período, colaborador elegido y el estado de cada consulta. */
@Service()
export class MetricsStore {
  private readonly _service = inject(MetricsService);

  readonly $summary = computed<TAsyncState<TSummaryResponse>>(() =>
    mapResource(this._service.summary),
  );
  readonly $agents = computed<TAsyncState<TAgentsResponse>>(() =>
    mapResource(this._service.agents),
  );
  readonly $problems = computed<TAsyncState<TProblems>>(() =>
    mapResource(this._service.problems),
  );
  readonly $agentDetail = computed<TAsyncState<TAgentDetail>>(() =>
    mapResource(this._service.agentDetail),
  );
  readonly $agentEmail = this._service.$agentEmail;

  selectAgent(email: string | undefined): void {
    this._service.selectAgent(email);
  }

  reload(): void {
    this._service.reload();
  }
}
