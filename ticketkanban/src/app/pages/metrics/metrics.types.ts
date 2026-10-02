import type { z } from 'zod';
import type {
  AgentDetailResponseSchema,
  AgentRowSchema,
  AgentsResponseSchema,
  AgentTicketRowSchema,
  METRIC_STATUS,
  ProblemsResponseSchema,
  SummaryResponseSchema,
  SummarySchema,
  TargetsSchema,
} from './metrics.schema';

export type TMetricStatus = (typeof METRIC_STATUS)[number];
export type TSummary = z.output<typeof SummarySchema>;
export type TTargets = z.output<typeof TargetsSchema>;
export type TSummaryResponse = z.output<typeof SummaryResponseSchema>;
export type TAgentRow = z.output<typeof AgentRowSchema>;
export type TAgentsResponse = z.output<typeof AgentsResponseSchema>;
export type TAgentTicketRow = z.output<typeof AgentTicketRowSchema>;
export type TAgentDetail = z.output<typeof AgentDetailResponseSchema>;
export type TProblems = z.output<typeof ProblemsResponseSchema>;
