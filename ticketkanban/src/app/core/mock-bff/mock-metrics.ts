import { TICKET_CATEGORY_META } from '../../pages/tickets/ticket.constants';
import type { TAgentDetail, TAgentsResponse, TProblems, TSummary, TSummaryResponse, TTargets } from '../../pages/metrics/metrics.types';
import type { IMockTicket } from './mock-bff.data';

/**
 * Métricas del mock BFF: mismas METAS y mismas reglas de semáforo que `metrics-engine.ts` del backend, pero
 * calculadas con lo que el mock sabe de cada ticket (no guarda el historial de eventos). Por eso la primera
 * respuesta se infiere del estado (`new` = sin responder) y los tiempos son de reloj corrido, sin horario hábil.
 * Sirve para probar la pantalla y los flujos alternos A1–A3; los números reales los calcula el backend.
 */
export const MOCK_TARGETS: TTargets = {
  firstContactPct: 75,
  responseCompliancePct: 95,
  resolutionCompliancePct: 95,
  csat: 4.5,
  reopenPctMax: 5,
  csatMinResponses: 10,
};

const AMBER_POINTS = 5;
const AMBER_CSAT = 0.3;
const MINUTE = 60_000;
const DAY = 86_400_000;
const RESPONSE_MINUTES = 120;
const RESOLUTION_MINUTES = { critical: 120, high: 480, medium: 480, low: 1440 } as const;
const OPEN: readonly string[] = ['new', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'reopened'];

export interface IMockMetricsInput {
  tickets: readonly IMockTicket[];
  /** Calificaciones de encuesta por ticket. */
  surveys: ReadonlyMap<string, { score: number; comment: string | null }>;
  /** Correos de las personas del equipo que atienden (rol AGENT). */
  agentEmails: readonly string[];
  nameOf: (email: string) => string;
  ownerName: (ownerUuid: string) => string;
  from: Date;
  to: Date;
  now: Date;
}

const round = (n: number, digits = 1): number => Math.round(n * 10 ** digits) / 10 ** digits;
const within = (iso: string | null, from: Date, to: Date): boolean => !!iso && new Date(iso) >= from && new Date(iso) <= to;
const planned = (t: IMockTicket): number => RESOLUTION_MINUTES[t.priority] * (t.priority === 'low' && t.type === 'improvement' ? 2 : 1);

type TValue = { value: number | null; sample: number; status: 'ok' | 'warning' | 'critical' | 'no-data' };

function percentage(part: number, total: number, target: number): TValue {
  if (total === 0) return { value: null, sample: 0, status: 'no-data' };
  const value = round((part / total) * 100);
  return { value, sample: total, status: value >= target ? 'ok' : value >= target - AMBER_POINTS ? 'warning' : 'critical' };
}

function percentageMax(part: number, total: number, max: number): TValue {
  if (total === 0) return { value: null, sample: 0, status: 'no-data' };
  const value = round((part / total) * 100);
  return { value, sample: total, status: value <= max ? 'ok' : value <= max * 2 ? 'warning' : 'critical' };
}

/** Estado del plazo de resolución de un ticket (misma lógica que `present` del handler). */
function resolutionStatus(t: IMockTicket, now: Date): 'met' | 'breached' | 'running' | 'paused' | 'escalated' {
  if (t.status === 'escalated') return 'escalated';
  if (t.status === 'pending_customer') return 'paused';
  if (t.status === 'resolved' || t.status === 'closed') {
    const minutes = t.resolvedAt ? (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / MINUTE : 0;
    return minutes <= planned(t) ? 'met' : 'breached';
  }
  return now.getTime() > new Date(t.createdAt).getTime() + planned(t) * MINUTE ? 'breached' : 'running';
}

function responseStatus(t: IMockTicket, now: Date): 'met' | 'breached' | 'pending' {
  if (t.status !== 'new') return 'met';
  return now.getTime() > new Date(t.createdAt).getTime() + RESPONSE_MINUTES * MINUTE ? 'breached' : 'pending';
}

/** Resumen de un conjunto de tickets en el período. Un conjunto vacío da ceros y «sin información» (A1/A3). */
export function mockSummarize(tickets: readonly IMockTicket[], input: IMockMetricsInput): TSummary {
  const { from, to, now, surveys } = input;
  const created = tickets.filter((t) => within(t.createdAt, from, to));
  const open = tickets.filter((t) => OPEN.includes(t.status));

  const judged = created.filter((t) => responseStatus(t, now) !== 'pending');
  const responseMet = judged.filter((t) => responseStatus(t, now) === 'met');

  const resolvedIn = tickets.filter((t) => within(t.resolvedAt, from, to));
  const cycles = resolvedIn.filter((t) => t.status !== 'escalated');
  const cyclesMet = cycles.filter((t) => resolutionStatus(t, now) === 'met');
  const averageResolution = cycles.length
    ? round(cycles.reduce((sum, t) => sum + (new Date(t.resolvedAt as string).getTime() - new Date(t.createdAt).getTime()) / MINUTE, 0) / cycles.length)
    : null;

  const fcrYes = resolvedIn.filter((t) => t.reopenCount === 0);
  const reopened = resolvedIn.filter((t) => t.reopenCount > 0);

  const scores = tickets.map((t) => surveys.get(t.uuid)?.score).filter((s): s is number => s !== undefined);
  const csatAverage = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const closedTickets = tickets.filter((t) => t.status === 'closed');

  const age = (t: IMockTicket): number => now.getTime() - new Date(t.createdAt).getTime();

  return {
    tickets: {
      created: created.length,
      attended: created.filter((t) => t.status !== 'new').length,
      pending: open.length,
      resolved: resolvedIn.length,
      closed: tickets.filter((t) => within(t.closedAt, from, to)).length,
      autoClosed: 0,
      escalated: created.filter((t) => t.status === 'escalated').length,
      overdue: open.filter((t) => resolutionStatus(t, now) === 'breached').length,
    },
    firstContact: percentage(fcrYes.length, resolvedIn.length, MOCK_TARGETS.firstContactPct),
    firstResponse: { ...percentage(responseMet.length, judged.length, MOCK_TARGETS.responseCompliancePct), averageMinutes: null },
    resolution: { ...percentage(cyclesMet.length, cycles.length, MOCK_TARGETS.resolutionCompliancePct), averageMinutes: averageResolution },
    reopenRate: percentageMax(reopened.length, resolvedIn.length, MOCK_TARGETS.reopenPctMax),
    csat: {
      value: csatAverage === null ? null : round(csatAverage, 2),
      sample: scores.length,
      status:
        scores.length < MOCK_TARGETS.csatMinResponses || csatAverage === null
          ? 'no-data'
          : csatAverage >= MOCK_TARGETS.csat
            ? 'ok'
            : csatAverage >= MOCK_TARGETS.csat - AMBER_CSAT
              ? 'warning'
              : 'critical',
      satisfiedPct: scores.length ? round((scores.filter((s) => s >= 4).length / scores.length) * 100) : null,
      responseRate: closedTickets.length ? round((scores.length / closedTickets.length) * 100) : null,
      responses: scores.length,
      sent: closedTickets.length,
    },
    backlogAging: {
      underOneDay: open.filter((t) => age(t) < DAY).length,
      oneToThreeDays: open.filter((t) => age(t) >= DAY && age(t) <= 3 * DAY).length,
      overThreeDays: open.filter((t) => age(t) > 3 * DAY).length,
    },
  };
}

const periodOut = (input: IMockMetricsInput) => ({ from: input.from.toISOString(), to: input.to.toISOString() });

export function mockSummaryResponse(input: IMockMetricsInput): TSummaryResponse {
  return { period: periodOut(input), targets: MOCK_TARGETS, summary: mockSummarize(input.tickets, input) };
}

/** Quienes aparecen como responsables: los AGENTES + cualquier otra persona con tickets. */
function agentEmails(input: IMockMetricsInput): string[] {
  const assignees = input.tickets.map((t) => t.assigneeEmail).filter(Boolean);
  return [...new Set([...input.agentEmails, ...assignees])].sort((a, b) => a.localeCompare(b));
}

export function mockAgentsResponse(input: IMockMetricsInput): TAgentsResponse {
  return {
    period: periodOut(input),
    targets: MOCK_TARGETS,
    data: agentEmails(input).map((email) => ({
      email,
      name: input.nameOf(email),
      summary: mockSummarize(input.tickets.filter((t) => t.assigneeEmail === email), input),
    })),
  };
}

export function mockAgentDetail(email: string, input: IMockMetricsInput): TAgentDetail {
  const mine = input.tickets.filter((t) => t.assigneeEmail === email);
  return {
    period: periodOut(input),
    targets: MOCK_TARGETS,
    email,
    name: input.nameOf(email),
    summary: mockSummarize(mine, input),
    tickets: mine
      .filter((t) => within(t.createdAt, input.from, input.to) || t.status !== 'closed')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({
        uuid: t.uuid,
        code: t.code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        createdAt: new Date(t.createdAt).toISOString(),
        responseStatus: responseStatus(t, input.now),
        resolutionStatus: resolutionStatus(t, input.now),
        resolutionDueAt:
          t.status === 'escalated' || t.status === 'pending_customer' ? null : new Date(new Date(t.createdAt).getTime() + planned(t) * MINUTE).toISOString(),
        firstContact: t.resolvedAt ? t.reopenCount === 0 : null,
        csat: input.surveys.get(t.uuid)?.score ?? null,
      })),
  };
}

export function mockProblems(input: IMockMetricsInput): TProblems {
  const inPeriod = input.tickets.filter((t) => within(t.createdAt, input.from, input.to));
  const categories = [...new Set(inPeriod.map((t) => t.category))];
  const byCategory = categories
    .map((category) => {
      const group = inPeriod.filter((t) => t.category === category);
      const judged = group.filter((t) => ['met', 'breached'].includes(resolutionStatus(t, input.now)));
      const resolved = group.filter((t) => t.resolvedAt);
      return {
        category,
        count: group.length,
        outOfSlaPct: judged.length ? round((judged.filter((t) => resolutionStatus(t, input.now) === 'breached').length / judged.length) * 100) : null,
        reopenPct: resolved.length ? round((resolved.filter((t) => t.reopenCount > 0).length / resolved.length) * 100) : null,
        averageResolutionMinutes: resolved.length
          ? round(resolved.reduce((s, t) => s + (new Date(t.resolvedAt as string).getTime() - new Date(t.createdAt).getTime()) / MINUTE, 0) / resolved.length)
          : null,
      };
    })
    .sort((a, b) => b.count - a.count);

  const byHour = Array.from({ length: 24 }, () => 0);
  for (const t of inPeriod) {
    const hour = new Date(new Date(t.createdAt).getTime() - 6 * 60 * MINUTE).getUTCHours();
    byHour[hour] = (byHour[hour] ?? 0) + 1;
  }

  const groups = new Map<string, IMockTicket[]>();
  for (const t of inPeriod) groups.set(`${t.ownerUuid}|${t.category}`, [...(groups.get(`${t.ownerUuid}|${t.category}`) ?? []), t]);
  const recurring = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => ({ requester: input.ownerName(g[0].ownerUuid), category: g[0].category, count: g.length, codes: g.map((t) => t.code) }))
    .sort((a, b) => b.count - a.count);

  const lowScores = input.tickets.flatMap((t) => {
    const survey = input.surveys.get(t.uuid);
    return survey && survey.score <= 2 ? [{ code: t.code, score: survey.score, comment: survey.comment, assignee: t.assigneeEmail || null }] : [];
  });

  return { period: periodOut(input), byCategory, recurring, byHour, lowScores };
}

/** Evita que el compilador descarte el import (las etiquetas de categoría las usa la pantalla). */
export const MOCK_CATEGORY_CODES = Object.keys(TICKET_CATEGORY_META);
