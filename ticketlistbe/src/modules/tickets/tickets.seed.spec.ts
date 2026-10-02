import { summarize, type IMetricsTicket } from '../metrics/metrics-engine.js';
import { canTransition } from './lifecycle/ticket-lifecycle.js';
import { analyzeTicket } from './sla/ticket-analysis.js';
import { buildTicketsSeed } from './tickets.seed.js';

/** Los datos de demostración deben ser coherentes con las reglas: si no, las métricas de desarrollo mienten. */
describe('datos iniciales de tickets', () => {
  const now = new Date('2026-10-14T16:00:00Z'); // miércoles
  const seed = buildTicketsSeed({ demo: true, now });

  it('en las pruebas solo están los 3 tickets de siempre', () => {
    expect(buildTicketsSeed({ demo: false }).tickets.map((t) => t.code)).toEqual(['TCK-001', 'TCK-002', 'TCK-003']);
  });

  it('cada ticket tiene código único y sus eventos arrancan con CREATED', () => {
    const codes = seed.tickets.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const ticket of seed.tickets) {
      const events = seed.events.filter((e) => e.ticketUuid === ticket.uuid).sort((a, b) => a.at.getTime() - b.at.getTime());
      expect(events[0]?.type, ticket.code).toBe('CREATED');
    }
  });

  it('toda transición sembrada es legal para quien la hizo, y el estado final coincide con el del ticket', () => {
    for (const ticket of seed.tickets) {
      const changes = seed.events.filter((e) => e.ticketUuid === ticket.uuid && e.type === 'STATUS_CHANGED');
      let current = seed.events.find((e) => e.ticketUuid === ticket.uuid && e.type === 'CREATED')?.status;
      // El estado inicial puede pasar de «Nuevo» a «Asignado» por la asignación inicial.
      for (const change of changes.sort((a, b) => a.at.getTime() - b.at.getTime())) {
        expect(change.from, `${ticket.code}: ${change.from} → ${change.to}`).toBe(current);
        // El historial guarda «personal»: basta con que algún rol del equipo pudiera hacerlo.
        const roles = change.actor === 'staff' ? (['agent', 'supervisor', 'admin'] as const) : ([change.actor] as const);
        expect(roles.some((role) => canTransition(change.from!, change.to!, role)), `${ticket.code}: ${change.from} → ${change.to} por ${change.actor}`).toBe(true);
        current = change.to;
      }
      expect(current, ticket.code).toBe(ticket.status);
    }
  });

  it('las encuestas pertenecen a tickets cerrados y tienen calificación 1–5', () => {
    for (const survey of seed.surveys) {
      const ticket = seed.tickets.find((t) => t.uuid === survey.ticketUuid);
      expect(ticket?.status === 'closed' || ticket?.closedAt !== null).toBe(true);
      expect(survey.score).toBeGreaterThanOrEqual(1);
      expect(survey.score).toBeLessThanOrEqual(5);
    }
  });

  it('con esos datos el motor da indicadores con sentido (FCR, SLA y CSAT con muestra)', () => {
    const facts: IMetricsTicket[] = seed.tickets.map((ticket) => ({
      uuid: ticket.uuid,
      code: ticket.code,
      title: ticket.title,
      ownerUuid: ticket.ownerUuid,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      assignee: ticket.assigneeEmail || null,
      analysis: analyzeTicket({
        createdAt: ticket.createdAt,
        events: seed.events.filter((e) => e.ticketUuid === ticket.uuid),
        policy: { responseMinutes: ticket.slaResponseMinutes, resolutionMinutes: ticket.slaResolutionMinutes },
        now,
      }),
      survey: (() => {
        const s = seed.surveys.find((x) => x.ticketUuid === ticket.uuid);
        return s ? { sentAt: s.sentAt, answeredAt: s.answeredAt, score: s.score, comment: s.comment } : null;
      })(),
    }));
    const summary = summarize(facts, { from: new Date('2026-09-01T00:00:00Z'), to: now }, now);
    expect(summary.firstContact.sample).toBeGreaterThan(5);
    expect(summary.firstResponse.sample).toBeGreaterThan(5);
    expect(summary.resolution.sample).toBeGreaterThan(5);
    expect(summary.csat.sample).toBeGreaterThanOrEqual(10);
    expect(summary.tickets.autoClosed).toBeGreaterThanOrEqual(1);
    expect(summary.tickets.escalated).toBeGreaterThanOrEqual(1);
    expect(summary.reopenRate.value).toBeGreaterThan(0);
  });
});
