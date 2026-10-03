import type { z } from 'zod';
import type { MyTicketListSchema, TICKET_EVENT_TYPES, TicketEventListSchema, TicketEventSchema } from './my-tickets.schema';

export type TTicketEvent = z.output<typeof TicketEventSchema>;
export type TTicketEventList = z.output<typeof TicketEventListSchema>;
export type TTicketEventType = (typeof TICKET_EVENT_TYPES)[number];
export type TMyTicketList = z.output<typeof MyTicketListSchema>;
