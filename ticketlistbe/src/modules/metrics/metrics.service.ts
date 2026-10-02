import { Injectable } from '@nestjs/common';
import type * as z from 'zod';
import { EUserRole } from '../auth/casl/ability.enum.js';
import { DEFAULT_CALENDAR } from '../tickets/sla/business-calendar.js';
import { TicketHistoryService } from '../tickets/ticket-history.service.js';
import type { TicketEntity } from '../tickets/ticket.entity.js';
import { TicketSurveysRepository } from '../tickets/surveys/ticket-surveys.repository.js';
import { TicketsRepository } from '../tickets/tickets.repository.js';
import { UsersRepository } from '../users/users.repository.js';
import {
  frequentProblems,
  summarize,
  TARGETS,
  type IMetricsTicket,
  type IPeriod,
} from './metrics-engine.js';
import type {
  AgentDetailResponseSchema,
  AgentsResponseSchema,
  MetricsPeriodQuerySchema,
  ProblemsResponseSchema,
  SummaryResponseSchema,
} from './metrics.schema.js';

type TPeriodQuery = z.output<typeof MetricsPeriodQuerySchema>;
const DAY_MS = 86_400_000;
const DEFAULT_PERIOD_DAYS = 30;

const targets = {
  firstContactPct: TARGETS.firstContactPct,
  responseCompliancePct: TARGETS.responseCompliancePct,
  resolutionCompliancePct: TARGETS.resolutionCompliancePct,
  csat: TARGETS.csat,
  reopenPctMax: TARGETS.reopenPctMax,
  csatMinResponses: TARGETS.csatMinResponses,
};

/**
 * Arma los datos del motor (`metrics-engine.ts`) a partir de tickets, historial y encuestas. Solo LEE:
 * ninguna consulta de métricas modifica un ticket (postcondición de CU04). No aplica el filtro de filas
 * por usuario — las métricas son agregadas y el acceso lo decide la habilidad `Metric`/`MyMetric`.
 */
@Injectable()
export class MetricsService {
  constructor(
    private readonly tickets: TicketsRepository,
    private readonly history: TicketHistoryService,
    private readonly surveys: TicketSurveysRepository,
    private readonly users: UsersRepository,
  ) {}

  summary(query: TPeriodQuery, now = new Date()): z.output<typeof SummaryResponseSchema> {
    const period = this.period(query, now);
    return { period: this.periodOut(period), targets, summary: summarize(this.facts(now), period, now) };
  }

  agents(query: TPeriodQuery, now = new Date()): z.output<typeof AgentsResponseSchema> {
    const period = this.period(query, now);
    const facts = this.facts(now);
    const emails = this.agentEmails(facts);
    return {
      period: this.periodOut(period),
      targets,
      data: emails.map((email) => ({
        email,
        name: this.users.findByEmail(email)?.name ?? email,
        summary: summarize(facts.filter((t) => t.assignee === email), period, now),
      })),
    };
  }

  /** Métricas de UNA persona del equipo y los tickets que gestionó (CU04, pasos 4 y 5). */
  agentDetail(email: string, query: TPeriodQuery, now = new Date()): z.output<typeof AgentDetailResponseSchema> {
    const period = this.period(query, now);
    const mine = this.facts(now).filter((t) => t.assignee === email);
    return {
      period: this.periodOut(period),
      targets,
      email,
      name: this.users.findByEmail(email)?.name ?? email,
      summary: summarize(mine, period, now),
      tickets: mine
        .filter((t) => t.createdAt >= period.from && t.createdAt <= period.to || t.status !== 'closed')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((t) => {
          const cycle = t.analysis.cycles.at(-1);
          return {
            uuid: t.uuid,
            code: t.code,
            title: t.title,
            status: t.status,
            priority: t.priority,
            createdAt: t.createdAt.toISOString(),
            responseStatus: t.analysis.firstResponse.status,
            resolutionStatus: cycle?.status ?? 'running',
            resolutionDueAt: cycle?.dueAt?.toISOString() ?? null,
            firstContact: t.analysis.firstContact,
            csat: t.survey?.score ?? null,
          };
        }),
    };
  }

  problems(query: TPeriodQuery, now = new Date()): z.output<typeof ProblemsResponseSchema> {
    const period = this.period(query, now);
    const facts = this.facts(now);
    const result = frequentProblems(facts, period, DEFAULT_CALENDAR);
    return {
      period: this.periodOut(period),
      byCategory: result.byCategory,
      recurring: result.recurring.map((r) => ({
        requester: this.users.findAdminByUuid(r.ownerUuid)?.name ?? 'Cuenta desconocida',
        category: r.category,
        count: r.count,
        codes: r.codes,
      })),
      byHour: result.byHour,
      lowScores: facts
        .filter((t) => t.survey?.score !== null && t.survey?.score !== undefined && t.survey.score <= 2 && t.survey.answeredAt && t.survey.answeredAt >= period.from && t.survey.answeredAt <= period.to)
        .map((t) => ({ code: t.code, score: t.survey?.score as number, comment: t.survey?.comment ?? null, assignee: t.assignee })),
    };
  }

  // ── Internos ───────────────────────────────────────────────────────────────────────────────
  /** Quienes aparecen como responsables: los AGENTES del sistema + cualquier otra persona con tickets. */
  private agentEmails(facts: readonly IMetricsTicket[]): string[] {
    const fromRole = this.users.listByRole(EUserRole.AGENT).map((u) => u.email);
    const others = facts.map((t) => t.assignee).filter((a): a is string => !!a);
    return [...new Set([...fromRole, ...others])].sort((a, b) => a.localeCompare(b));
  }

  private facts(now: Date): IMetricsTicket[] {
    const surveys = new Map(this.surveys.listAll().map((s) => [s.ticketUuid, s]));
    return this.tickets.findAllRows().map((ticket) => this.toFact(ticket, surveys.get(ticket.uuid) ?? null, now));
  }

  private toFact(ticket: TicketEntity, survey: ReturnType<TicketSurveysRepository['find']>, now: Date): IMetricsTicket {
    const analysis = this.history.analyze(ticket, now);
    // Se atribuye a quien lo tenía al resolverlo; si sigue abierto, a quien lo tiene hoy.
    const cutoff = analysis.firstResolvedAt ?? now;
    const assignedBefore = this.history
      .eventsOf(ticket.uuid)
      .filter((e) => e.type === 'ASSIGNED' && e.at <= cutoff && e.assignee)
      .at(-1)?.assignee;
    return {
      uuid: ticket.uuid,
      code: ticket.code,
      title: ticket.title,
      ownerUuid: ticket.ownerUuid,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      createdAt: ticket.createdAt,
      assignee: assignedBefore ?? (ticket.assigneeEmail || null),
      analysis,
      survey: survey
        ? { sentAt: survey.sentAt, answeredAt: survey.answeredAt, score: survey.score, comment: survey.comment }
        : null,
    };
  }

  private period(query: TPeriodQuery, now: Date): IPeriod {
    // Una fecha sin hora cubre el día completo (hasta el último milisegundo) en UTC.
    const to = query.to ? (query.to.length === 10 ? new Date(new Date(query.to).getTime() + DAY_MS - 1) : new Date(query.to)) : now;
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_PERIOD_DAYS * DAY_MS);
    return { from, to };
  }

  private periodOut(period: IPeriod): { from: string; to: string } {
    return { from: period.from.toISOString(), to: period.to.toISOString() };
  }
}
