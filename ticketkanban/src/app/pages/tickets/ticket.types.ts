import type { z } from 'zod';
import type {
  TICKET_CATEGORY,
  TICKET_PRIORITY,
  TICKET_STATUS,
  TicketBoardSchema,
  TicketQuickCreateSchema,
  TicketSchema,
  TicketUpsertSchema,
} from './ticket.schema';

export type TTicketStatus = (typeof TICKET_STATUS)[number];
export type TTicketPriority = (typeof TICKET_PRIORITY)[number];
export type TTicketCategory = (typeof TICKET_CATEGORY)[number];

export type TTicket = z.output<typeof TicketSchema>;
export type TTicketUpsert = z.output<typeof TicketUpsertSchema>;
export type TTicketQuickCreate = z.output<typeof TicketQuickCreateSchema>;
export type TTicketBoard = z.output<typeof TicketBoardSchema>;

/** Ciclo de vida del guardado (FSM de `TicketsStore`). */
export type TSaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type TSaveEvent = 'SUBMIT' | 'SUCCEED' | 'FAIL';
