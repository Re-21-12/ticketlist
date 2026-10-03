import { z } from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';
import { TICKET_STATUS, TicketSchema } from '../tickets/ticket.schema';

/** Tipos de renglón del historial de un ticket (espejo de `TicketEventResponseSchema` del backend). */
export const TICKET_EVENT_TYPES = ['CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENT_PUBLIC', 'COMMENT_INTERNAL', 'SURVEY_SENT', 'SURVEY_ANSWERED', 'NOTIFIED'] as const;

export const TicketEventSchema = z.object({
  uuid: z.uuid(),
  type: z.enum(TICKET_EVENT_TYPES),
  at: z.coerce.date(),
  visibility: z.enum(['public', 'internal']),
  actor: z.enum(['customer', 'staff', 'system']),
  actorName: z.string(),
  from: z.enum(TICKET_STATUS).nullable(),
  to: z.enum(TICKET_STATUS).nullable(),
  body: z.string().nullable(),
  attachments: z.array(z.object({ id: z.uuid(), name: z.string(), mimeType: z.string(), size: z.number().int() })),
  assignee: z.string().nullable(),
});
export const TicketEventListSchema = z.object({ data: z.array(TicketEventSchema) });

/** `GET /api/tickets?mine=true`: página de tickets propios. */
export const MyTicketListSchema = z.object({
  data: z.array(TicketSchema),
  meta: z.object({ total: z.number().int(), page: z.number().int(), take: z.number().int() }),
});

export const COMMENT_MAX = 2000;

/** Comentario nuevo del solicitante (el backend lo valida igual: 1 a 2000 caracteres). */
export const CommentFormSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El comentario', min: 1 }) })
    .max(COMMENT_MAX, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El comentario', max: COMMENT_MAX }) }),
});
