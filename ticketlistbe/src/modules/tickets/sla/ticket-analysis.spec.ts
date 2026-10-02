import type { TTicketStatus } from '../lifecycle/ticket-lifecycle.js';
import { DEFAULT_SLA_BY_PRIORITY, policyFor } from './sla-policy.js';
import { analyzeTicket, type ITicketEventFact } from './ticket-analysis.js';

// UTC−6, jornada 8:00–17:00 L–V. 2026-10-05 es lunes.
const at = (day: string, time: string): Date => new Date(`2026-10-${day}T${time}:00-06:00`);
const created = at('05', '09:00');

const status = (when: Date, to: TTicketStatus, extra: Partial<ITicketEventFact> = {}): ITicketEventFact => ({
  type: 'STATUS_CHANGED',
  at: when,
  actor: 'staff',
  to,
  ...extra,
});
const reply = (when: Date, actor: 'staff' | 'customer' = 'staff'): ITicketEventFact => ({ type: 'COMMENT_PUBLIC', at: when, actor });

const policy = DEFAULT_SLA_BY_PRIORITY.medium; // 2 h de respuesta, 8 h de resolución
const analyze = (events: ITicketEventFact[], now = at('05', '17:00')) => analyzeTicket({ createdAt: created, events, policy, now });

describe('primera respuesta', () => {
  it('cumple si una PERSONA responde dentro de 2 h hábiles', () => {
    expect(analyze([reply(at('05', '10:30'))]).firstResponse).toMatchObject({ minutes: 90, status: 'met' });
  });

  it('incumple si responde después de 2 h', () => {
    expect(analyze([reply(at('05', '11:30'))]).firstResponse).toMatchObject({ minutes: 150, status: 'breached' });
  });

  it('un acuse automático o una nota interna NO cuentan', () => {
    const auto: ITicketEventFact = { type: 'COMMENT_PUBLIC', at: at('05', '09:01'), actor: 'system' };
    const internal: ITicketEventFact = { type: 'COMMENT_INTERNAL', at: at('05', '09:05'), actor: 'staff' };
    expect(analyze([auto, internal], at('05', '09:30')).firstResponse).toMatchObject({ minutes: null, status: 'pending' });
  });

  it('sin respuesta y con el plazo vencido ya es incumplimiento (no se espera a que conteste)', () => {
    expect(analyze([], at('05', '11:30')).firstResponse).toMatchObject({ minutes: null, status: 'breached' });
  });

  it('una respuesta del CLIENTE no es respuesta del equipo', () => {
    expect(analyze([reply(at('05', '09:30'), 'customer')], at('05', '09:45')).firstResponse.status).toBe('pending');
  });

  it('el reloj cuenta solo horas hábiles: creado el viernes 16:00, respondido el lunes 9:00 son 2 h', () => {
    const friday = new Date('2026-10-09T16:00:00-06:00');
    const result = analyzeTicket({ createdAt: friday, events: [reply(new Date('2026-10-12T09:00:00-06:00'))], policy, now: at('13', '12:00') });
    expect(result.firstResponse).toMatchObject({ minutes: 120, status: 'met' });
  });
});

describe('vencimientos', () => {
  it('el plazo de respuesta vence 2 h hábiles después; el de resolución, 8 h hábiles (con pausas)', () => {
    const result = analyze([]);
    expect(result.firstResponse.dueAt).toEqual(at('05', '11:00'));
    expect(result.cycles[0]?.dueAt).toEqual(at('05', '17:00'));
    const paused = analyze([status(at('05', '10:00'), 'pending_customer'), status(at('05', '12:00'), 'in_progress')], at('05', '13:00'));
    expect(paused.cycles[0]?.dueAt).toEqual(at('06', '10:00')); // 9–10 + 12–17 + 2 h del martes
  });

  it('en pausa no hay vencimiento (el reloj está detenido)', () => {
    expect(analyze([status(at('05', '10:00'), 'pending_customer')], at('05', '11:00')).cycles[0]?.dueAt).toBeNull();
  });
});

describe('resolución por ciclo', () => {
  it('resuelto a tiempo → cumple', () => {
    const result = analyze([status(at('05', '09:30'), 'in_progress'), status(at('05', '14:00'), 'resolved')]);
    expect(result.cycles).toEqual([expect.objectContaining({ minutes: 300, status: 'met' })]);
  });

  it('resuelto tarde → incumple', () => {
    const result = analyze([status(at('06', '16:00'), 'resolved')], at('07', '10:00'));
    expect(result.cycles[0]).toMatchObject({ status: 'breached' });
  });

  it('abierto y dentro de plazo → en curso; abierto y vencido → incumple YA (flujo A2 de CU04)', () => {
    expect(analyze([], at('05', '12:00')).cycles[0]).toMatchObject({ status: 'running', minutes: 180 });
    expect(analyze([], at('06', '12:00')).cycles[0]).toMatchObject({ status: 'breached' });
  });

  it('«Pendiente del cliente» pausa el reloj: lo que espera el cliente no corre contra el agente', () => {
    const events = [status(at('05', '10:00'), 'pending_customer'), status(at('06', '10:00'), 'in_progress'), status(at('06', '12:00'), 'resolved')];
    const [cycle] = analyze(events, at('06', '13:00')).cycles;
    // 1 h antes de la pausa (9–10) + 2 h tras reanudar (martes 10–12) = 3 h; las ~24 h de espera no cuentan.
    expect(cycle).toMatchObject({ minutes: 180, status: 'met' });
  });

  it('en pausa y dentro de plazo se reporta «en pausa»', () => {
    expect(analyze([status(at('05', '10:00'), 'pending_customer')], at('05', '16:00')).cycles[0]).toMatchObject({ status: 'paused', minutes: 60 });
  });

  it('un escalado a N2/N3 queda fuera del SLA', () => {
    const result = analyze([status(at('05', '10:00'), 'escalated'), status(at('07', '10:00'), 'resolved')]);
    expect(result.escalated).toBe(true);
    expect(result.cycles[0]?.status).toBe('escalated');
  });

  it('reabrir inicia un ciclo NUEVO con su propio plazo; el original ya contó', () => {
    const events = [
      status(at('05', '11:00'), 'resolved'),
      status(at('06', '09:00'), 'reopened', { actor: 'customer' }),
      status(at('06', '10:00'), 'resolved'),
    ];
    const result = analyze(events, at('06', '12:00'));
    expect(result.reopenCount).toBe(1);
    expect(result.cycles.map((c) => c.status)).toEqual(['met', 'met']);
    expect(result.cycles[1]?.minutes).toBe(60);
  });
});

describe('resolución al primer contacto (FCR)', () => {
  it('una sola respuesta del agente y resuelto → sí', () => {
    const events = [reply(at('05', '09:30')), status(at('05', '09:40'), 'resolved')];
    expect(analyze(events).firstContact).toBe(true);
  });

  it('dos o más respuestas del agente → no', () => {
    const events = [reply(at('05', '09:30')), reply(at('05', '10:00')), status(at('05', '10:10'), 'resolved')];
    expect(analyze(events).firstContact).toBe(false);
  });

  it('pedirle datos al cliente rompe el primer contacto', () => {
    const events = [reply(at('05', '09:30')), status(at('05', '09:40'), 'pending_customer'), status(at('05', '10:00'), 'in_progress'), status(at('05', '10:10'), 'resolved')];
    expect(analyze(events).firstContact).toBe(false);
  });

  it('las notas internas no cuentan como contacto', () => {
    const internal: ITicketEventFact = { type: 'COMMENT_INTERNAL', at: at('05', '09:20'), actor: 'staff' };
    const events = [internal, internal, reply(at('05', '09:30')), status(at('05', '09:40'), 'resolved')];
    expect(analyze(events).firstContact).toBe(true);
  });

  it('un escalado no cuenta', () => {
    const events = [status(at('05', '09:30'), 'escalated'), status(at('05', '10:00'), 'resolved')];
    expect(analyze(events).firstContact).toBe(false);
  });

  it('si se reabre dentro de 7 días deja de contar (aunque ya se hubiera reportado)', () => {
    const resolved = [reply(at('05', '09:30')), status(at('05', '09:40'), 'resolved')];
    expect(analyze(resolved).firstContact).toBe(true);
    expect(analyze([...resolved, status(at('09', '10:00'), 'reopened', { actor: 'customer' })], at('09', '12:00')).firstContact).toBe(false);
  });

  it('una reapertura después de la ventana de 7 días no resta', () => {
    const events = [reply(at('05', '09:30')), status(at('05', '09:40'), 'resolved'), status(new Date('2026-10-20T10:00:00-06:00'), 'reopened', { actor: 'customer' })];
    expect(analyze(events, new Date('2026-10-20T12:00:00-06:00')).firstContact).toBe(true);
  });

  it('sin resolver todavía → null (no entra al cálculo)', () => {
    expect(analyze([reply(at('05', '09:30'))]).firstContact).toBeNull();
  });
});

describe('cierre y la política', () => {
  it('registra quién cerró: el cliente o el sistema (48 h)', () => {
    expect(analyze([status(at('05', '10:00'), 'resolved'), status(at('05', '11:00'), 'closed', { actor: 'customer', by: 'customer' })]).closedBy).toBe('customer');
    expect(analyze([status(at('05', '10:00'), 'resolved'), status(at('07', '10:00'), 'closed', { actor: 'system', by: 'system' })]).closedBy).toBe('system');
    expect(analyze([]).closedBy).toBeNull();
  });

  it('la política: crítico 2 h, medio/alto 8 h, bajo 24 h y las mejoras bajas 48 h', () => {
    expect(policyFor('critical', 'incident').resolutionMinutes).toBe(120);
    expect(policyFor('high', 'incident').resolutionMinutes).toBe(480);
    expect(policyFor('medium', 'service_request').resolutionMinutes).toBe(480);
    expect(policyFor('low', 'service_request').resolutionMinutes).toBe(1440);
    expect(policyFor('low', 'improvement').resolutionMinutes).toBe(2880);
    expect(policyFor('critical', 'improvement').responseMinutes).toBe(120);
  });
});
