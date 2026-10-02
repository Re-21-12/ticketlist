import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../common/codes/validation-errors.js';
import { TICKET_STATUS } from '../tickets/lifecycle/ticket-lifecycle.js';

/** Período de consulta: ISO (`2026-10-01` o con hora). Sin `from`/`to`, los últimos 30 días. */
export const MAX_PERIOD_DAYS = 366;

export const MetricsPeriodQuerySchema = z
  .object({
    from: z.union([z.iso.datetime({ offset: true }), z.iso.date()], { error: msg(V.GENERIC.IS_DATE) }).optional(),
    to: z.union([z.iso.datetime({ offset: true }), z.iso.date()], { error: msg(V.GENERIC.IS_DATE) }).optional(),
  })
  .refine((q) => !q.from || !q.to || new Date(q.from) <= new Date(q.to), {
    error: msg(V.METRICS.PERIOD_ORDER),
    path: ['to'],
  })
  .refine((q) => !q.from || !q.to || (new Date(q.to).getTime() - new Date(q.from).getTime()) / 86_400_000 <= MAX_PERIOD_DAYS, {
    error: msg(V.METRICS.PERIOD_TOO_LONG, { max: MAX_PERIOD_DAYS }),
    path: ['to'],
  });

const MetricValue = z.object({
  /** `null` = sin información (nunca un 0 % engañoso). */
  value: z.number().nullable(),
  sample: z.number().int(),
  status: z.enum(['ok', 'warning', 'critical', 'no-data']),
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
  firstContact: MetricValue,
  firstResponse: MetricValue.extend({ averageMinutes: z.number().nullable() }),
  resolution: MetricValue.extend({ averageMinutes: z.number().nullable() }),
  reopenRate: MetricValue,
  csat: MetricValue.extend({
    satisfiedPct: z.number().nullable(),
    responseRate: z.number().nullable(),
    responses: z.number().int(),
    sent: z.number().int(),
  }),
  backlogAging: z.object({ underOneDay: z.number().int(), oneToThreeDays: z.number().int(), overThreeDays: z.number().int() }),
});

/** Metas contra las que se pintan los semáforos (para que la pantalla las muestre sin duplicarlas). */
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

export const AgentRowSchema = z.object({
  email: z.string(),
  name: z.string(),
  summary: SummarySchema,
});
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
  /** Comentarios de calificaciones bajas (1–2) para revisión del supervisor. */
  lowScores: z.array(z.object({ code: z.string(), score: z.number().int(), comment: z.string().nullable(), assignee: z.string().nullable() })),
});

export const AgentEmailParamSchema = z.object({ email: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).transform((e) => e.toLowerCase()) });
