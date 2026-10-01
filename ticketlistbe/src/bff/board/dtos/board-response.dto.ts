import * as z from 'zod';
import { TICKET_STATUS, TicketResponseSchema } from '../../../modules/tickets/schemas/ticket.schema.js';

/** Espejo de `TicketBoardSchema` del front: columnas ya agrupadas y con etiqueta. */
export const BoardResponseSchema = z.object({
  columns: z.array(
    z.object({
      status: z.enum(TICKET_STATUS),
      label: z.string(),
      tickets: z.array(TicketResponseSchema),
    }),
  ),
});

export type TBoardResponse = z.output<typeof BoardResponseSchema>;
