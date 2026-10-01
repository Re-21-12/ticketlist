import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';

/**
 * CONTRATO del recurso Ticket — espejo 1:1 de ticketkanban/src/app/pages/tickets/ticket.schema.ts
 * hasta extraer el paquete compartido `@ticketit/contracts`. Mismas reglas y mismos mensajes: lo
 * que el formulario valida es exactamente lo que este backend valida.
 */
export const TICKET_STATUS = ['todo', 'in_progress', 'done'] as const;
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'] as const;
export const TICKET_CATEGORY = ['bug', 'feature', 'support', 'other'] as const;

/** Fecha SIN hora: 'YYYY-MM-DD' (JSON) o `Date`. Nunca `z.coerce.date()` (corre el día por UTC). */
const LocalDateSchema = z.union(
  [
    z.date(),
    z.iso.date().transform((iso) => {
      const [year, month, day] = iso.split('-').map(Number);
      return new Date(year, month - 1, day);
    }),
  ],
  { error: msg(V.GENERIC.IS_DATE) },
);

export const TicketBaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El título', min: 3 }) })
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El título', max: 120 }) }),
  description: z
    .string()
    .trim()
    .max(2000, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La descripción', max: 2000 }) }),
  category: z.enum(TICKET_CATEGORY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una categoría' }) }),
  otherCategoryDetail: z
    .string()
    .trim()
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El detalle', max: 120 }) })
    .optional(),
  priority: z.enum(TICKET_PRIORITY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una prioridad' }) }),
  status: z.enum(TICKET_STATUS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un estado' }) }),
  assigneeEmail: z
    .email({ error: msg(V.GENERIC.IS_EMAIL) })
    .or(z.literal('')),
  estimateHours: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(1, { error: msg(V.GENERIC.MIN_VALUE, { min: 1 }) })
    .max(200, { error: msg(V.GENERIC.MAX_VALUE, { max: 200 }) })
    .nullable(),
  dueDate: LocalDateSchema.nullable(),
  notifyReporter: z.boolean(),
});

/** Regla cross-field compartida por alta y edición. `when`: corre aunque otro campo falle. */
const hasDetailWhenOther = (t: { category: string; otherCategoryDetail?: string }) =>
  t.category !== 'other' || !!t.otherCategoryDetail;
const otherNeedsDetail = {
  error: msg(V.TICKET.OTHER_CATEGORY_DETAIL_REQUIRED),
  path: ['otherCategoryDetail'],
  when: (payload: { value: unknown }) =>
    TicketBaseSchema.pick({ category: true, otherCategoryDetail: true }).safeParse(payload.value)
      .success,
};

/** PATCH: todos los campos editables + regla cross-field. */
export const TicketUpsertSchema = TicketBaseSchema.refine(hasDetailWhenOther, otherNeedsDetail);

/**
 * POST: mismo contrato con defaults para lo que el alta rápida no envía. UN schema (no una unión
 * upsert | rápida): con la unión, un body completo pero inválido podía caer en la rama «rápida»
 * y perder campos en silencio.
 */
export const TicketCreateSchema = TicketBaseSchema.extend({
  status: TicketBaseSchema.shape.status.default('todo'),
  assigneeEmail: TicketBaseSchema.shape.assigneeEmail.default(''),
  estimateHours: TicketBaseSchema.shape.estimateHours.default(null),
  dueDate: TicketBaseSchema.shape.dueDate.default(null),
  notifyReporter: TicketBaseSchema.shape.notifyReporter.default(false),
}).refine(hasDetailWhenOther, otherNeedsDetail);

/** Respuesta: lo que viaja por JSON (fechas como string) — lo que parsea el front con `TicketSchema`. */
export const TicketResponseSchema = TicketBaseSchema.extend({
  uuid: z.uuid(),
  /** Titular (creador): la base de las reglas de dueño y de lo que comparte. */
  ownerUuid: z.uuid(),
  code: z.string(),
  dueDate: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
});

export const TicketFilterSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
});
