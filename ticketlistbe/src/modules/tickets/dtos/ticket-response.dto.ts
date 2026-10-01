import type * as z from 'zod';
import { paginatedSchema } from '../../../core/dtos/paginated-response.dto.js';
import { TicketResponseSchema } from '../schemas/ticket.schema.js';

export type TTicketResponse = z.output<typeof TicketResponseSchema>;
export const TicketPageSchema = paginatedSchema(TicketResponseSchema);
