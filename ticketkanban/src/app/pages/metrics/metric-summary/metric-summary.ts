import { Component, computed, input } from '@angular/core';
import { MetricCard } from '../metric-card/metric-card';
import { buildMetricCards } from '../metrics.cards';
import type { TSummary, TTargets } from '../metrics.types';

/**
 * Resumen de indicadores de un conjunto de tickets (equipo, colaborador o «mis métricas»): tarjetas con semáforo,
 * conteos operativos y antigüedad del backlog. Un conjunto sin tickets muestra ceros y «Sin información», nunca un
 * error (flujos alternos A1 y A3 de CU05).
 */
@Component({
  selector: 'app-metric-summary',
  imports: [MetricCard],
  templateUrl: './metric-summary.html',
  styleUrl: './metric-summary.css',
})
export class MetricSummary {
  readonly $summary = input.required<TSummary>();
  readonly $targets = input.required<TTargets>();

  protected readonly $cards = computed(() => buildMetricCards(this.$summary(), this.$targets()));

  protected readonly $counts = computed(() => {
    const t = this.$summary().tickets;
    return [
      { key: 'created', label: 'Creados', value: t.created, icon: 'pi-plus-circle' },
      { key: 'attended', label: 'Atendidos', value: t.attended, icon: 'pi-comments' },
      { key: 'pending', label: 'Pendientes', value: t.pending, icon: 'pi-inbox' },
      { key: 'resolved', label: 'Resueltos', value: t.resolved, icon: 'pi-check' },
      { key: 'closed', label: 'Cerrados', value: t.closed, icon: 'pi-lock' },
      { key: 'auto', label: 'Cerrados solos (48 h)', value: t.autoClosed, icon: 'pi-clock' },
      { key: 'escalated', label: 'Escalados N2/N3', value: t.escalated, icon: 'pi-angle-double-up' },
      { key: 'overdue', label: 'Fuera de SLA (abiertos)', value: t.overdue, icon: 'pi-exclamation-circle', alert: t.overdue > 0 },
    ];
  });

  protected readonly $aging = computed(() => {
    const a = this.$summary().backlogAging;
    const total = a.underOneDay + a.oneToThreeDays + a.overThreeDays;
    const row = (key: string, label: string, value: number) => ({ key, label, value, pct: total ? Math.round((value / total) * 100) : 0 });
    return { total, rows: [row('fresh', 'Menos de 1 día', a.underOneDay), row('mid', '1 a 3 días', a.oneToThreeDays), row('old', 'Más de 3 días', a.overThreeDays)] };
  });

  /** Sin ningún ticket en el período ni abiertos: se avisa en lugar de mostrar solo ceros. */
  protected readonly $isEmpty = computed(() => {
    const t = this.$summary().tickets;
    return t.created === 0 && t.pending === 0 && t.resolved === 0 && t.closed === 0;
  });
}
