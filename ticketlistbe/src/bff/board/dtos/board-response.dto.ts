import * as z from 'zod';
import { STATUS_GROUP_KEYS } from '../../../modules/tickets/lifecycle/ticket-lifecycle.js';
import { TICKET_STATUS, TicketResponseSchema } from '../../../modules/tickets/schemas/ticket.schema.js';

/**
 * Espejo de `TicketBoardSchema` del front: TRES columnas (los estados son variaciones de tres grandes) ya
 * agrupadas; cada tarjeta lleva su estado exacto para pintarlo como insignia.
 */
export const BoardResponseSchema = z.object({
  /** Límite de trabajo en progreso (WIP) del equipo: tickets «En progreso» ahora y cuántos admite a la vez. */
  wip: z.object({ status: z.literal('in_progress'), limit: z.number().int(), count: z.number().int() }),
  columns: z.array(
    z.object({
      group: z.enum(STATUS_GROUP_KEYS as [string, ...string[]]),
      label: z.string(),
      /** Estados que caen en esta columna (en orden de flujo). */
      statuses: z.array(z.enum(TICKET_STATUS)),
      tickets: z.array(TicketResponseSchema),
    }),
  ),
});

export type TBoardResponse = z.output<typeof BoardResponseSchema>;
