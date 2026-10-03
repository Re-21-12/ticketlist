import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { TICKET_STATUS } from '../lifecycle/ticket-lifecycle.js';

/** Máximo de adjuntos por comentario y tamaño de cada uno (A2 de la historia de seguimiento). */
export const MAX_ATTACHMENTS_PER_COMMENT = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * Un comentario NUEVO. No hay schema de actualización: lo anterior no se modifica (trazabilidad); la
 * corrección es otro comentario. `internal` (nota del equipo) solo lo acepta el personal.
 */
export const CommentCreateSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El comentario', min: 1 }) })
    .max(2000, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El comentario', max: 2000 }) }),
  internal: z.boolean().default(false),
  attachmentIds: z.array(z.uuid()).max(MAX_ATTACHMENTS_PER_COMMENT).default([]),
});

/**
 * Cambio de estado. Resolver exige documentar la solución (el requerimiento: «se documentará»). `note` es
 * el motivo opcional (p. ej. al reabrir o escalar).
 */
export const TransitionSchema = z
  .strictObject({
    to: z.enum(TICKET_STATUS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un estado' }) }),
    note: z.string().trim().max(500, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La nota', max: 500 }) }).optional(),
    resolution: z.string().trim().max(2000, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La solución', max: 2000 }) }).optional(),
  })
  .refine((value) => value.to !== 'resolved' || (value.resolution?.length ?? 0) >= 3, {
    error: msg(V.TICKET.RESOLUTION_REQUIRED),
    path: ['resolution'],
  });

export const AssignSchema = z.strictObject({
  assigneeEmail: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).transform((email) => email.toLowerCase()),
});

/** Calificación CSAT: 1 a 5 y un comentario opcional (nadie está obligado a explicarse). */
export const SurveyAnswerSchema = z.strictObject({
  score: z.number({ error: msg(V.TICKET.SURVEY_SCORE) }).int({ error: msg(V.TICKET.SURVEY_SCORE) }).min(1, { error: msg(V.TICKET.SURVEY_SCORE) }).max(5, { error: msg(V.TICKET.SURVEY_SCORE) }),
  comment: z.string().trim().max(500, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El comentario', max: 500 }) }).nullable().default(null),
});

export const AttachmentRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
});

/** Un renglón del historial tal como lo ve quien consulta (las notas internas ya vienen filtradas). */
export const TicketEventResponseSchema = z.object({
  uuid: z.uuid(),
  type: z.enum(['CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'COMMENT_PUBLIC', 'COMMENT_INTERNAL', 'SURVEY_SENT', 'SURVEY_ANSWERED', 'NOTIFIED']),
  at: z.iso.datetime(),
  visibility: z.enum(['public', 'internal']),
  actor: z.enum(['customer', 'staff', 'system']),
  actorName: z.string(),
  from: z.enum(TICKET_STATUS).nullable(),
  to: z.enum(TICKET_STATUS).nullable(),
  body: z.string().nullable(),
  attachments: z.array(AttachmentRefSchema),
  assignee: z.string().nullable(),
});
export const TicketEventListSchema = z.object({ data: z.array(TicketEventResponseSchema) });

export const SurveyStateSchema = z.object({
  /** `pending`: se puede responder · `answered`: ya respondió · `expired`: venció sin respuesta. */
  state: z.enum(['pending', 'answered', 'expired']),
  expiresAt: z.iso.datetime(),
  score: z.number().int().nullable(),
  comment: z.string().nullable(),
});

export const AttachmentResponseSchema = AttachmentRefSchema;
