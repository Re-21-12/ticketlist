import { computed, inject, Service } from '@angular/core';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { MetricsService } from './metrics.service';
import type { TAgentDetail, TAgentsResponse, TProblems, TSummaryResponse } from './metrics.types';

/** Estado de pantalla de «Métricas del equipo»: período, colaborador elegido y el estado de cada consulta. */
@Service()
export class MetricsStore {
  private readonly _service = inject(MetricsService);

  readonly $summary = computed<TAsyncState<TSummaryResponse>>(() =>
    mapResourceState(this._service.summary.status(), this._service.summary.value(), this._service.summary.error()),
  );
  readonly $agents = computed<TAsyncState<TAgentsResponse>>(() =>
    mapResourceState(this._service.agents.status(), this._service.agents.value(), this._service.agents.error()),
  );
  readonly $problems = computed<TAsyncState<TProblems>>(() =>
    mapResourceState(this._service.problems.status(), this._service.problems.value(), this._service.problems.error()),
  );
  readonly $agentDetail = computed<TAsyncState<TAgentDetail>>(() =>
    mapResourceState(this._service.agentDetail.status(), this._service.agentDetail.value(), this._service.agentDetail.error()),
  );
  readonly $agentEmail = this._service.$agentEmail;

  selectAgent(email: string | undefined): void {
    this._service.selectAgent(email);
  }

  reload(): void {
    this._service.reload();
  }
}
