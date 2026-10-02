import type { z } from 'zod';
import type {
  AssigneeListSchema,
  SurveyFormSchema,
  SurveyStateSchema,
  TICKET_CATEGORY,
  TICKET_STATUS_GROUPS,
  TICKET_COMPLEXITY,
  TICKET_TYPE,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TicketBoardSchema,
  TicketQuickCreateSchema,
  TicketTransitionSchema,
  TicketSchema,
  TicketUpsertSchema,
} from './ticket.schema';

export type TTicketStatus = (typeof TICKET_STATUS)[number];
export type TTicketPriority = (typeof TICKET_PRIORITY)[number];
export type TSurveyForm = z.output<typeof SurveyFormSchema>;
export type TSurveyState = z.output<typeof SurveyStateSchema>;
export type TTicketStatusGroup = (typeof TICKET_STATUS_GROUPS)[number];
export type TTicketType = (typeof TICKET_TYPE)[number];
export type TTicketComplexity = (typeof TICKET_COMPLEXITY)[number];
export type TTicketCategory = (typeof TICKET_CATEGORY)[number];

export type TTicket = z.output<typeof TicketSchema>;
export type TTicketUpsert = z.output<typeof TicketUpsertSchema>;
export type TTicketQuickCreate = z.output<typeof TicketQuickCreateSchema>;
export type TTicketTransition = z.input<typeof TicketTransitionSchema>;
export type TTicketBoard = z.output<typeof TicketBoardSchema>;
export type TAssignee = z.output<typeof AssigneeListSchema>['data'][number];

/** Ciclo de vida del guardado (FSM de `TicketsStore`). */
export type TSaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type TSaveEvent = 'SUBMIT' | 'SUCCEED' | 'FAIL';
