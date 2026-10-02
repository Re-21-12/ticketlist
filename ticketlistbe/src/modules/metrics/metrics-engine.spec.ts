import type { TTicketStatus } from '../tickets/lifecycle/ticket-lifecycle.js';
import { DEFAULT_SLA_BY_PRIORITY } from '../tickets/sla/sla-policy.js';
import { analyzeTicket, type ITicketEventFact } from '../tickets/sla/ticket-analysis.js';
import { frequentProblems, summarize, summarizeByAssignee, type IMetricsSurvey, type IMetricsTicket } from './metrics-engine.js';

const at = (day: string, time = '09:00'): Date => new Date(`2026-10-${day}T${time}:00-06:00`);
const PERIOD = { from: at('01', '00:00'), to: at('31', '23:59') };
const NOW = at('30', '12:00');

const change = (when: Date, to: TTicketStatus, extra: Partial<ITicketEventFact> = {}): ITicketEventFact => ({
  type: 'STATUS_CHANGED',
  at: when,
  actor: 'staff',
  to,
  ...extra,
});
const reply = (when: Date): ITicketEventFact => ({ type: 'COMMENT_PUBLIC', at: when, actor: 'staff' });

let seq = 0;
function ticket(over: {
  createdAt?: Date;
  events?: ITicketEventFact[];
  status?: TTicketStatus;
  assignee?: string | null;
  owner?: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  survey?: IMetricsSurvey | null;
}): IMetricsTicket {
  seq += 1;
  const createdAt = over.createdAt ?? at('05');
  const priority = over.priority ?? 'medium';
  return {
    uuid: `u-${seq}`,
    code: `TCK-${String(seq).padStart(3, '0')}`,
    title: `t${seq}`,
    ownerUuid: over.owner ?? 'cliente-1',
    category: over.category ?? 'support',
    priority,
    status: over.status ?? 'closed',
    createdAt,
    assignee: over.assignee === undefined ? 'ana@ticketit.dev' : over.assignee,
    analysis: analyzeTicket({ createdAt, events: over.events ?? [], policy: DEFAULT_SLA_BY_PRIORITY[priority], now: NOW }),
    survey: over.survey ?? null,
  };
}

/** Resuelto al primer contacto y a tiempo (1 respuesta en 30 min, resuelto en 1 h). */
const goodTicket = (over: Parameters<typeof ticket>[0] = {}) =>
  ticket({
    createdAt: at('05', '09:00'),
    events: [reply(at('05', '09:30')), change(at('05', '10:00'), 'resolved'), change(at('05', '11:00'), 'closed', { actor: 'customer', by: 'customer' })],
    ...over,
  });

describe('sin datos (A1 de CU04)', () => {
  it('sin tickets nada se inventa: valor null y estado no-data, no 0 %', () => {
    const s = summarize([], PERIOD, NOW);
    expect(s.firstContact).toEqual({ value: null, sample: 0, status: 'no-data' });
    expect(s.firstResponse.value).toBeNull();
    expect(s.resolution.value).toBeNull();
    expect(s.csat.value).toBeNull();
    expect(s.tickets.created).toBe(0);
  });

  it('un colaborador sin tickets muestra ceros (A3), no un error', () => {
    const rows = summarizeByAssignee([goodTicket()], ['ana@ticketit.dev', 'luis@ticketit.dev'], PERIOD, NOW);
    expect(rows[1]?.summary.tickets).toMatchObject({ created: 0, pending: 0, resolved: 0 });
  });
});

describe('FCR', () => {
  it('= resueltos al primer contacto ÷ resueltos; verde sobre 75 %, ámbar 70–75, rojo menos', () => {
    const fcr = (yes: number, no: number) => {
      const yesTickets = Array.from({ length: yes }, () => goodTicket());
      const noTickets = Array.from({ length: no }, () =>
        ticket({ events: [reply(at('05', '09:30')), reply(at('05', '09:45')), change(at('05', '10:00'), 'resolved')] }),
      );
      return summarize([...yesTickets, ...noTickets], PERIOD, NOW).firstContact;
    };
    expect(fcr(8, 2)).toEqual({ value: 80, sample: 10, status: 'ok' });
    expect(fcr(15, 5)).toEqual({ value: 75, sample: 20, status: 'ok' });
    expect(fcr(14, 6)).toEqual({ value: 70, sample: 20, status: 'warning' });
    expect(fcr(5, 5)).toEqual({ value: 50, sample: 10, status: 'critical' });
  });

  it('un ticket sin resolver no entra al denominador', () => {
    const open = ticket({ status: 'in_progress', events: [reply(at('05', '09:30'))] });
    expect(summarize([goodTicket(), open], PERIOD, NOW).firstContact).toMatchObject({ value: 100, sample: 1 });
  });
});

describe('primera respuesta', () => {
  it('cumplimiento = respondidos en ≤ 2 h ÷ (respondidos + vencidos sin respuesta); los pendientes no cuentan', () => {
    const fast = goodTicket();
    const slow = ticket({ events: [reply(at('05', '13:00')), change(at('05', '14:00'), 'resolved')] });
    const waitingBreached = ticket({ status: 'new', events: [], createdAt: at('29', '09:00') });
    const waitingPending = ticket({ status: 'new', events: [], createdAt: at('30', '11:00') });
    const s = summarize([fast, slow, waitingBreached, waitingPending], PERIOD, NOW);
    expect(s.firstResponse).toMatchObject({ value: 33.3, sample: 3, status: 'critical' });
    expect(s.firstResponse.averageMinutes).toBe(135); // (30 + 240) / 2
  });
});

describe('cumplimiento de resolución', () => {
  it('= ciclos resueltos a tiempo ÷ ciclos resueltos; los escalados quedan fuera', () => {
    const onTime = goodTicket();
    const late = ticket({ events: [reply(at('05', '09:30')), change(at('07', '16:00'), 'resolved')] });
    const escalated = ticket({ events: [change(at('05', '10:00'), 'escalated'), change(at('09', '10:00'), 'resolved')] });
    const s = summarize([onTime, late, escalated], PERIOD, NOW);
    expect(s.resolution).toMatchObject({ value: 50, sample: 2, status: 'critical' });
    expect(s.tickets.escalated).toBe(1);
  });

  it('un ticket abierto fuera de plazo se cuenta como vencido de inmediato', () => {
    const overdue = ticket({ status: 'in_progress', createdAt: at('20', '09:00'), events: [reply(at('20', '09:30'))] });
    expect(summarize([overdue, goodTicket()], PERIOD, NOW).tickets).toMatchObject({ pending: 1, overdue: 1 });
  });
});

describe('reapertura y cierre', () => {
  it('la tasa de reapertura sale de los resueltos del período; ≤ 5 % es verde', () => {
    const reopened = ticket({ events: [reply(at('05', '09:30')), change(at('05', '10:00'), 'resolved'), change(at('06', '09:00'), 'reopened', { actor: 'customer' })] });
    const s = summarize([...Array.from({ length: 19 }, () => goodTicket()), reopened], PERIOD, NOW);
    expect(s.reopenRate).toEqual({ value: 5, sample: 20, status: 'ok' });
    expect(summarize([goodTicket(), reopened], PERIOD, NOW).reopenRate.status).toBe('critical');
  });

  it('cuenta cierres automáticos (48 h sin respuesta)', () => {
    const auto = ticket({ events: [change(at('05', '10:00'), 'resolved'), change(at('07', '10:00'), 'closed', { actor: 'system', by: 'system' })] });
    expect(summarize([auto, goodTicket()], PERIOD, NOW).tickets).toMatchObject({ closed: 2, autoClosed: 1 });
  });
});

describe('CSAT', () => {
  const survey = (score: number | null, comment: string | null = null): IMetricsSurvey => ({
    sentAt: at('06', '09:00'),
    answeredAt: score === null ? null : at('06', '10:00'),
    score,
    comment,
  });

  it('promedia las respuestas; con menos de 10 dice «datos insuficientes» en vez de un promedio engañoso', () => {
    const few = Array.from({ length: 5 }, () => goodTicket({ survey: survey(5) }));
    const s = summarize(few, PERIOD, NOW).csat;
    expect(s).toMatchObject({ value: 5, sample: 5, status: 'no-data', responses: 5 });
  });

  it('con 10 o más: ≥ 4.5 verde, 4.2–4.5 ámbar, menos rojo; además % satisfechos y tasa de respuesta', () => {
    const build = (scores: (number | null)[]) => summarize(scores.map((score) => goodTicket({ survey: survey(score) })), PERIOD, NOW).csat;
    const green = build([5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 5]);
    expect(green).toMatchObject({ status: 'ok', responses: 12, satisfiedPct: 100 });
    expect(green.value).toBeCloseTo(4.67, 2);
    const amber = build([5, 5, 5, 5, 4, 4, 4, 4, 4, 4]);
    expect(amber).toMatchObject({ value: 4.4, status: 'warning' });
    const red = build([5, 4, 3, 3, 4, 2, 3, 4, 5, 1]);
    expect(red.status).toBe('critical');
    expect(red.satisfiedPct).toBe(50);
    const withUnanswered = build([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, null, null]);
    expect(withUnanswered).toMatchObject({ sent: 12, responses: 10, responseRate: 83.3 });
  });
});

describe('atención y antigüedad del backlog', () => {
  it('cuenta atendidos, pendientes y la antigüedad por rango', () => {
    const fresh = ticket({ status: 'new', createdAt: at('30', '08:00'), events: [] });
    const middle = ticket({ status: 'in_progress', createdAt: at('28', '09:00'), events: [reply(at('28', '09:30'))] });
    const old = ticket({ status: 'assigned', createdAt: at('20', '09:00'), events: [] });
    const s = summarize([fresh, middle, old, goodTicket()], PERIOD, NOW);
    expect(s.tickets).toMatchObject({ created: 4, attended: 2, pending: 3 });
    expect(s.backlogAging).toEqual({ underOneDay: 1, oneToThreeDays: 1, overThreeDays: 1 });
  });
});

describe('métricas por colaborador', () => {
  it('separa a cada persona y no mezcla sus tickets', () => {
    const ana = [goodTicket(), goodTicket()];
    const luis = [goodTicket({ assignee: 'luis@ticketit.dev' }), ticket({ assignee: 'luis@ticketit.dev', events: [reply(at('05', '14:00')), change(at('05', '15:00'), 'resolved')] })];
    const rows = summarizeByAssignee([...ana, ...luis], ['ana@ticketit.dev', 'luis@ticketit.dev'], PERIOD, NOW);
    expect(rows[0]?.summary.firstResponse.value).toBe(100);
    expect(rows[1]?.summary.firstResponse).toMatchObject({ value: 50, sample: 2 });
  });
});

describe('problemas frecuentes', () => {
  it('agrupa por categoría, ordena por volumen y mide fuera de SLA y reapertura', () => {
    const tickets = [
      goodTicket({ category: 'bug' }),
      ticket({ category: 'bug', events: [reply(at('05', '09:30')), change(at('08', '16:00'), 'resolved')] }),
      goodTicket({ category: 'support' }),
    ];
    const { byCategory } = frequentProblems(tickets, PERIOD);
    expect(byCategory.map((c) => [c.category, c.count])).toEqual([['bug', 2], ['support', 1]]);
    expect(byCategory[0]).toMatchObject({ outOfSlaPct: 50, reopenPct: 0 });
  });

  it('detecta recurrencia: el mismo solicitante y categoría ≥ 2 veces en 30 días', () => {
    const tickets = [
      goodTicket({ owner: 'rrhh-1', category: 'bug', createdAt: at('02') }),
      goodTicket({ owner: 'rrhh-1', category: 'bug', createdAt: at('20') }),
      goodTicket({ owner: 'rrhh-2', category: 'bug', createdAt: at('05') }),
    ];
    const { recurring } = frequentProblems(tickets, PERIOD);
    expect(recurring).toEqual([expect.objectContaining({ ownerUuid: 'rrhh-1', category: 'bug', count: 2 })]);
  });

  it('histograma por hora LOCAL de creación', () => {
    const { byHour } = frequentProblems([goodTicket({ createdAt: at('05', '09:00') }), goodTicket({ createdAt: at('06', '09:30') }), goodTicket({ createdAt: at('06', '14:00') })], PERIOD);
    expect(byHour[9]).toBe(2);
    expect(byHour[14]).toBe(1);
    expect(byHour.reduce((a, b) => a + b, 0)).toBe(3);
  });
});
