import { Component, computed, inject } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Badge } from '../../shared/ui/badge/badge';
import { Illustration } from '../../shared/ui/illustration/illustration';
import { TICKET_CATEGORY_META } from '../tickets/ticket.constants';
import type { TTicketCategory } from '../tickets/ticket.types';
import { MetricSummary } from './metric-summary/metric-summary';
import { MetricTickets } from './metric-tickets/metric-tickets';
import { MetricsPeriod } from './metrics-period/metrics-period';
import { METRIC_STATUS_META } from './metrics.constants';
import { formatMinutes, formatPct, formatScore } from './metrics.format';
import { MetricsStore } from './metrics.store';
import type { TMetricStatus } from './metrics.types';

/** Un indicador de una fila de la tabla de colaboradores: valor + semáforo (con texto e ícono) + muestra. */
interface ICell {
  display: string;
  status: TMetricStatus;
  sample: number;
}

const categoryLabel = (code: string): string => TICKET_CATEGORY_META[code as TTicketCategory]?.label ?? code;

/**
 * «Métricas del equipo» (tablero del supervisor, CU05): indicadores del servicio (SLA, FCR, CSAT), desempeño por
 * colaborador con su detalle, y problemas frecuentes. SOLO lectura: nada aquí modifica un ticket. Las fórmulas
 * viven en el backend; la pantalla solo les da formato.
 */
@Component({
  selector: 'app-metrics',
  imports: [Badge, ButtonModule, Illustration, MetricsPeriod, MetricSummary, MetricTickets],
  templateUrl: './metrics.html',
  styleUrl: './metrics.css',
})
export class Metrics {
  protected readonly _store = inject(MetricsStore);
  protected readonly statusMeta = METRIC_STATUS_META;

  protected readonly $agentRows = computed(() => {
    const state = this._store.$agents();
    if (state.kind !== 'success') return [];
    const cell = (display: string, status: TMetricStatus, sample: number): ICell => ({ display, status, sample });
    return state.data.data.map(({ email, name, summary: s }) => ({
      email,
      name,
      pending: s.tickets.pending,
      resolved: s.tickets.resolved,
      overdue: s.tickets.overdue,
      sla: cell(formatPct(s.resolution.value), s.resolution.status, s.resolution.sample),
      fcr: cell(formatPct(s.firstContact.value), s.firstContact.status, s.firstContact.sample),
      csat: cell(formatScore(s.csat.value), s.csat.status, s.csat.responses),
      averageResolution: formatMinutes(s.resolution.averageMinutes),
    }));
  });

  protected readonly $problems = computed(() => {
    const state = this._store.$problems();
    if (state.kind !== 'success') return null;
    const { byCategory, byHour, recurring, lowScores } = state.data;
    const peak = Math.max(0, ...byHour);
    const peakHour = peak > 0 ? byHour.indexOf(peak) : -1;
    return {
      categories: byCategory.map((c) => ({
        ...c,
        label: categoryLabel(c.category),
        outOfSla: formatPct(c.outOfSlaPct),
        reopen: formatPct(c.reopenPct),
        average: formatMinutes(c.averageResolutionMinutes),
      })),
      hours: byHour.map((count, hour) => ({ hour, count, pct: peak ? Math.round((count / peak) * 100) : 0, label: `${String(hour).padStart(2, '0')}:00` })),
      peakText: peakHour >= 0 ? `Hora pico: ${String(peakHour).padStart(2, '0')}:00 (${peak} ${peak === 1 ? 'ticket' : 'tickets'})` : 'Sin tickets en el período',
      recurring: recurring.map((r) => ({ ...r, categoryLabel: categoryLabel(r.category) })),
      lowScores,
    };
  });

  protected readonly $selectedName = computed(() => {
    const state = this._store.$agentDetail();
    return state.kind === 'success' ? state.data.name : (this._store.$agentEmail() ?? '');
  });

  protected select(email: string): void {
    this._store.selectAgent(email);
  }

  protected closeDetail(): void {
    this._store.selectAgent(undefined);
  }
}
