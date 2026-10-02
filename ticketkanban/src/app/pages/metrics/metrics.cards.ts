import { NO_DATA_TEXT } from './metrics.constants';
import { formatMinutes, formatPct, formatScore } from './metrics.format';
import type { IMetricCard } from './metrics.interface';
import type { TSummary, TTargets } from './metrics.types';

/** Agrega el tiempo medio solo si existe (sin él no se escribe «promedio Sin información»). */
const withAverage = (text: string, label: string, minutes: number | null): string => (minutes === null ? text : `${text} · ${label} ${formatMinutes(minutes)}`);

const sampleText = (n: number, singular: string, plural: string): string => `${n} ${n === 1 ? singular : plural}`;

/**
 * Arma las tarjetas de indicadores a partir del resumen del backend. NO calcula nada: solo da formato. Si no hay
 * muestra el valor es «Sin información» (A1 de CU05), nunca un 0 % engañoso.
 */
export function buildMetricCards(summary: TSummary, targets: TTargets): IMetricCard[] {
  const { firstContact, firstResponse, resolution, reopenRate, csat } = summary;
  const csatDetail =
    csat.status === 'no-data' && csat.responses > 0
      ? `Datos insuficientes: ${csat.responses} de ${targets.csatMinResponses} respuestas mínimas`
      : `${sampleText(csat.responses, 'respuesta', 'respuestas')} de ${csat.sent} enviadas`;

  return [
    {
      key: 'resolution',
      icon: 'pi-verified',
      label: 'Cumplimiento del SLA de resolución',
      display: formatPct(resolution.value),
      status: resolution.status,
      target: `Meta: > ${targets.resolutionCompliancePct} %`,
      detail: withAverage(sampleText(resolution.sample, 'ticket evaluado', 'tickets evaluados'), 'tiempo medio', resolution.averageMinutes),
    },
    {
      key: 'first-response',
      icon: 'pi-comments',
      label: 'Primera respuesta en plazo (< 2 h)',
      display: formatPct(firstResponse.value),
      status: firstResponse.status,
      target: `Meta: > ${targets.responseCompliancePct} %`,
      detail: withAverage(sampleText(firstResponse.sample, 'ticket evaluado', 'tickets evaluados'), 'promedio', firstResponse.averageMinutes),
    },
    {
      key: 'first-contact',
      icon: 'pi-check-circle',
      label: 'Resolución al primer contacto (FCR)',
      display: formatPct(firstContact.value),
      status: firstContact.status,
      target: `Meta: > ${targets.firstContactPct} %`,
      detail: sampleText(firstContact.sample, 'ticket resuelto', 'tickets resueltos'),
    },
    {
      key: 'csat',
      icon: 'pi-star',
      label: 'Satisfacción (CSAT)',
      display: formatScore(csat.value),
      status: csat.status,
      target: `Meta: ≥ ${targets.csat}`,
      detail: csat.value === null && csat.responses === 0 ? `${NO_DATA_TEXT}: aún no hay respuestas` : csatDetail,
    },
    {
      key: 'reopen',
      icon: 'pi-replay',
      label: 'Tasa de reapertura',
      display: formatPct(reopenRate.value),
      status: reopenRate.status,
      target: `Meta: < ${targets.reopenPctMax} %`,
      detail: sampleText(reopenRate.sample, 'ticket resuelto', 'tickets resueltos'),
    },
  ];
}
