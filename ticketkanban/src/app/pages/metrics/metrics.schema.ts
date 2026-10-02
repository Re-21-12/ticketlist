import { z } from 'zod';
import { TICKET_STATUS } from '../tickets/ticket.schema';

/** Contrato espejo de `modules/metrics/metrics.schema.ts` del backend (`GET /api/metrics/*`). */
export const METRIC_STATUS = ['ok', 'warning', 'critical', 'no-data'] as const;

const MetricValueSchema = z.object({
  /** `null` = sin información (A1 de CU05): nunca un 0 % engañoso. */
  value: z.number().nullable(),
  sample: z.number().int(),
  status: z.enum(METRIC_STATUS),
});

export const SummarySchema = z.object({
  tickets: z.object({
    created: z.number().int(),
    attended: z.number().int(),
    pending: z.number().int(),
    resolved: z.number().int(),
    closed: z.number().int(),
    autoClosed: z.number().int(),
    escalated: z.number().int(),
    overdue: z.number().int(),
  }),
  firstContact: MetricValueSchema,
  firstResponse: MetricValueSchema.extend({ averageMinutes: z.number().nullable() }),
  resolution: MetricValueSchema.extend({ averageMinutes: z.number().nullable() }),
  reopenRate: MetricValueSchema,
  csat: MetricValueSchema.extend({
    satisfiedPct: z.number().nullable(),
    responseRate: z.number().nullable(),
    responses: z.number().int(),
    sent: z.number().int(),
  }),
  backlogAging: z.object({ underOneDay: z.number().int(), oneToThreeDays: z.number().int(), overThreeDays: z.number().int() }),
});

export const TargetsSchema = z.object({
  firstContactPct: z.number(),
  responseCompliancePct: z.number(),
  resolutionCompliancePct: z.number(),
  csat: z.number(),
  reopenPctMax: z.number(),
  csatMinResponses: z.number().int(),
});

const PeriodSchema = z.object({ from: z.iso.datetime(), to: z.iso.datetime() });

export const SummaryResponseSchema = z.object({ period: PeriodSchema, targets: TargetsSchema, summary: SummarySchema });

export const AgentRowSchema = z.object({ email: z.string(), name: z.string(), summary: SummarySchema });
export const AgentsResponseSchema = z.object({ period: PeriodSchema, targets: TargetsSchema, data: z.array(AgentRowSchema) });

export const AgentTicketRowSchema = z.object({
  uuid: z.uuid(),
  code: z.string(),
  title: z.string(),
  status: z.enum(TICKET_STATUS),
  priority: z.string(),
  createdAt: z.iso.datetime(),
  responseStatus: z.enum(['met', 'breached', 'pending']),
  resolutionStatus: z.enum(['met', 'breached', 'running', 'paused', 'escalated']),
  resolutionDueAt: z.iso.datetime().nullable(),
  firstContact: z.boolean().nullable(),
  csat: z.number().int().nullable(),
});

export const AgentDetailResponseSchema = z.object({
  period: PeriodSchema,
  targets: TargetsSchema,
  email: z.string(),
  name: z.string(),
  summary: SummarySchema,
  tickets: z.array(AgentTicketRowSchema),
});

export const ProblemsResponseSchema = z.object({
  period: PeriodSchema,
  byCategory: z.array(
    z.object({
      category: z.string(),
      count: z.number().int(),
      outOfSlaPct: z.number().nullable(),
      reopenPct: z.number().nullable(),
      averageResolutionMinutes: z.number().nullable(),
    }),
  ),
  recurring: z.array(z.object({ requester: z.string(), category: z.string(), count: z.number().int(), codes: z.array(z.string()) })),
  byHour: z.array(z.number().int()).length(24),
  lowScores: z.array(z.object({ code: z.string(), score: z.number().int(), comment: z.string().nullable(), assignee: z.string().nullable() })),
});
