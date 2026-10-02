import { isOpen, type TTicketStatus } from '../tickets/lifecycle/ticket-lifecycle.js';
import { DEFAULT_CALENDAR, type IBusinessCalendar } from '../tickets/sla/business-calendar.js';
import type { ITicketAnalysis } from '../tickets/sla/ticket-analysis.js';

/**
 * Motor de métricas (docs/standard/metrics.md). Módulo PURO: recibe tickets ya analizados y calcula
 * los indicadores. Una sola fórmula por indicador y siempre `{ value, sample, status }`: sin muestra
 * suficiente el estado es `no-data`, nunca un 0 % engañoso.
 */
export type TMetricStatus = 'ok' | 'warning' | 'critical' | 'no-data';

export interface IMetricValue {
  /** `null` cuando no hay información (A1 de CU04). */
  readonly value: number | null;
  /** Tamaño de la muestra: con cuántos tickets/respuestas se calculó. */
  readonly sample: number;
  readonly status: TMetricStatus;
}

/** Metas (requerimiento) y márgenes del semáforo. */
export const TARGETS = {
  firstContactPct: 75,
  responseCompliancePct: 95,
  resolutionCompliancePct: 95,
  csat: 4.5,
  reopenPctMax: 5,
  /** Margen del ámbar: puntos porcentuales (o 0.3 de CSAT) por debajo de la meta. */
  amberPoints: 5,
  amberCsat: 0.3,
  /** Menos respuestas que esto en el período → «datos insuficientes». */
  csatMinResponses: 10,
} as const;

export interface IMetricsSurvey {
  readonly sentAt: Date;
  readonly answeredAt: Date | null;
  readonly score: number | null;
  readonly comment: string | null;
}

export interface IMetricsTicket {
  readonly uuid: string;
  readonly code: string;
  readonly title: string;
  readonly ownerUuid: string;
  readonly category: string;
  readonly priority: string;
  readonly status: TTicketStatus;
  readonly createdAt: Date;
  /** Responsable al resolver (o el actual si sigue abierto). */
  readonly assignee: string | null;
  readonly analysis: ITicketAnalysis;
  readonly survey: IMetricsSurvey | null;
}

export interface IPeriod {
  readonly from: Date;
  readonly to: Date;
}

const within = (date: Date | null, period: IPeriod): boolean => !!date && date >= period.from && date <= period.to;

const round = (n: number, digits = 1): number => Math.round(n * 10 ** digits) / 10 ** digits;
const mean = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** Porcentaje con semáforo: verde ≥ meta, ámbar hasta 5 puntos por debajo, rojo peor. */
function percentage(part: number, total: number, target: number): IMetricValue {
  if (total === 0) return { value: null, sample: 0, status: 'no-data' };
  const value = round((part / total) * 100);
  const status: TMetricStatus = value >= target ? 'ok' : value >= target - TARGETS.amberPoints ? 'warning' : 'critical';
  return { value, sample: total, status };
}

/** Porcentaje donde MENOS es mejor (reapertura): verde ≤ tope, ámbar hasta el doble, rojo más. */
function percentageMax(part: number, total: number, max: number): IMetricValue {
  if (total === 0) return { value: null, sample: 0, status: 'no-data' };
  const value = round((part / total) * 100);
  return { value, sample: total, status: value <= max ? 'ok' : value <= max * 2 ? 'warning' : 'critical' };
}

export interface ISummary {
  readonly tickets: {
    readonly created: number;
    /** Con al menos una respuesta humana. */
    readonly attended: number;
    /** Abiertos hoy (cualquiera que sea su fecha). */
    readonly pending: number;
    readonly resolved: number;
    readonly closed: number;
    readonly autoClosed: number;
    readonly escalated: number;
    /** Abiertos que YA superaron su plazo de resolución (A2 de CU04). */
    readonly overdue: number;
  };
  readonly firstContact: IMetricValue;
  readonly firstResponse: IMetricValue & { readonly averageMinutes: number | null };
  readonly resolution: IMetricValue & { readonly averageMinutes: number | null };
  readonly reopenRate: IMetricValue;
  readonly csat: IMetricValue & {
    readonly satisfiedPct: number | null;
    readonly responseRate: number | null;
    readonly responses: number;
    readonly sent: number;
  };
  readonly backlogAging: { readonly underOneDay: number; readonly oneToThreeDays: number; readonly overThreeDays: number };
}

const DAY_MS = 24 * 60 * 60_000;

/** Resumen de un conjunto de tickets en un período (§3 de la especificación). */
export function summarize(tickets: readonly IMetricsTicket[], period: IPeriod, now: Date): ISummary {
  const created = tickets.filter((t) => within(t.createdAt, period));
  const open = tickets.filter((t) => isOpen(t.status));

  // Primera respuesta: cohorte de tickets creados en el período que ya respondieron o vencieron el plazo.
  const responseJudged = created.filter((t) => t.analysis.firstResponse.status !== 'pending');
  const responseMet = responseJudged.filter((t) => t.analysis.firstResponse.status === 'met');
  const responseMinutes = created.map((t) => t.analysis.firstResponse.minutes).filter((m): m is number => m !== null);

  // Resolución: ciclos RESUELTOS en el período, sin los escalados (fuera de alcance).
  const cycles = tickets.flatMap((t) => t.analysis.cycles).filter((c) => within(c.resolvedAt, period) && c.status !== 'escalated');
  const cyclesMet = cycles.filter((c) => c.status === 'met');

  // FCR y reapertura: tickets cuya PRIMERA resolución cayó en el período.
  const firstResolved = tickets.filter((t) => within(t.analysis.firstResolvedAt, period));
  const fcrYes = firstResolved.filter((t) => t.analysis.firstContact === true);
  const reopened = firstResolved.filter((t) => t.analysis.reopenCount > 0);

  // CSAT: respuestas recibidas en el período.
  const surveys = tickets.map((t) => t.survey).filter((s): s is IMetricsSurvey => s !== null);
  const sent = surveys.filter((s) => within(s.sentAt, period));
  const answered = surveys.filter((s) => s.score !== null && within(s.answeredAt, period));
  const scores = answered.map((s) => s.score as number);
  const csatAverage = mean(scores);

  const age = (t: IMetricsTicket): number => now.getTime() - t.createdAt.getTime();

  return {
    tickets: {
      created: created.length,
      attended: created.filter((t) => t.analysis.firstResponse.minutes !== null).length,
      pending: open.length,
      resolved: tickets.filter((t) => within(t.analysis.firstResolvedAt, period)).length,
      closed: tickets.filter((t) => within(t.analysis.closedAt, period)).length,
      autoClosed: tickets.filter((t) => t.analysis.closedBy === 'system' && within(t.analysis.closedAt, period)).length,
      escalated: created.filter((t) => t.analysis.escalated).length,
      overdue: open.filter((t) => t.analysis.cycles.at(-1)?.status === 'breached').length,
    },
    firstContact: percentage(fcrYes.length, firstResolved.length, TARGETS.firstContactPct),
    firstResponse: {
      ...percentage(responseMet.length, responseJudged.length, TARGETS.responseCompliancePct),
      averageMinutes: roundOrNull(mean(responseMinutes)),
    },
    resolution: {
      ...percentage(cyclesMet.length, cycles.length, TARGETS.resolutionCompliancePct),
      averageMinutes: roundOrNull(mean(cycles.map((c) => c.minutes))),
    },
    reopenRate: percentageMax(reopened.length, firstResolved.length, TARGETS.reopenPctMax),
    csat: {
      value: csatAverage === null ? null : round(csatAverage, 2),
      sample: scores.length,
      status:
        scores.length < TARGETS.csatMinResponses || csatAverage === null
          ? 'no-data'
          : csatAverage >= TARGETS.csat
            ? 'ok'
            : csatAverage >= TARGETS.csat - TARGETS.amberCsat
              ? 'warning'
              : 'critical',
      satisfiedPct: scores.length ? round((scores.filter((s) => s >= 4).length / scores.length) * 100) : null,
      responseRate: sent.length ? round((answered.length / sent.length) * 100) : null,
      responses: scores.length,
      sent: sent.length,
    },
    backlogAging: {
      underOneDay: open.filter((t) => age(t) < DAY_MS).length,
      oneToThreeDays: open.filter((t) => age(t) >= DAY_MS && age(t) <= 3 * DAY_MS).length,
      overThreeDays: open.filter((t) => age(t) > 3 * DAY_MS).length,
    },
  };
}

const roundOrNull = (n: number | null): number | null => (n === null ? null : round(n));

/** Una fila por colaborador (CU04: métricas individuales). Un colaborador sin tickets muestra ceros (A3). */
export function summarizeByAssignee(
  tickets: readonly IMetricsTicket[],
  assignees: readonly string[],
  period: IPeriod,
  now: Date,
): { assignee: string; summary: ISummary }[] {
  return assignees.map((assignee) => ({
    assignee,
    summary: summarize(
      tickets.filter((t) => t.assignee === assignee),
      period,
      now,
    ),
  }));
}

// ── Problemas frecuentes y áreas críticas (§4) ──────────────────────────────────────────────────
export interface ICategoryStats {
  readonly category: string;
  readonly count: number;
  readonly outOfSlaPct: number | null;
  readonly reopenPct: number | null;
  readonly averageResolutionMinutes: number | null;
}

export interface IRecurringRequester {
  readonly ownerUuid: string;
  readonly category: string;
  readonly count: number;
  readonly codes: string[];
}

export interface IProblems {
  readonly byCategory: ICategoryStats[];
  /** Mismo solicitante y misma categoría ≥ 2 veces en 30 días. */
  readonly recurring: IRecurringRequester[];
  /** Tickets por hora local de creación (0–23). */
  readonly byHour: number[];
}

const RECURRENCE_WINDOW_MS = 30 * DAY_MS;

export function frequentProblems(
  tickets: readonly IMetricsTicket[],
  period: IPeriod,
  calendar: IBusinessCalendar = DEFAULT_CALENDAR,
): IProblems {
  const inPeriod = tickets.filter((t) => within(t.createdAt, period));

  const categories = [...new Set(inPeriod.map((t) => t.category))];
  const byCategory = categories
    .map<ICategoryStats>((category) => {
      const group = inPeriod.filter((t) => t.category === category);
      const cycles = group.flatMap((t) => t.analysis.cycles).filter((c) => c.status !== 'escalated');
      const judged = cycles.filter((c) => c.status !== 'running' && c.status !== 'paused');
      const resolved = group.filter((t) => t.analysis.firstResolvedAt !== null);
      const resolvedCycles = cycles.filter((c) => c.resolvedAt !== null);
      return {
        category,
        count: group.length,
        outOfSlaPct: judged.length ? round((judged.filter((c) => c.status === 'breached').length / judged.length) * 100) : null,
        reopenPct: resolved.length ? round((resolved.filter((t) => t.analysis.reopenCount > 0).length / resolved.length) * 100) : null,
        averageResolutionMinutes: roundOrNull(mean(resolvedCycles.map((c) => c.minutes))),
      };
    })
    .sort((a, b) => b.count - a.count);

  const recurring: IRecurringRequester[] = [];
  const groups = new Map<string, IMetricsTicket[]>();
  for (const ticket of inPeriod) {
    const key = `${ticket.ownerUuid}|${ticket.category}`;
    groups.set(key, [...(groups.get(key) ?? []), ticket]);
  }
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // Ventana deslizante: ≥ 2 tickets del mismo par dentro de 30 días.
    const cluster = sorted.filter((t, i) => sorted.some((other, j) => i !== j && Math.abs(other.createdAt.getTime() - t.createdAt.getTime()) <= RECURRENCE_WINDOW_MS));
    const [first] = cluster;
    if (first) recurring.push({ ownerUuid: first.ownerUuid, category: first.category, count: cluster.length, codes: cluster.map((t) => t.code) });
  }
  recurring.sort((a, b) => b.count - a.count);

  const byHour = Array.from({ length: 24 }, () => 0);
  for (const ticket of inPeriod) {
    const local = new Date(ticket.createdAt.getTime() + calendar.utcOffsetMinutes * 60_000);
    byHour[local.getUTCHours()] = (byHour[local.getUTCHours()] ?? 0) + 1;
  }
  return { byCategory, recurring, byHour };
}
