import * as z from 'zod';
import {
  VALIDATION_ERRORS as V,
  validationMessage as msg,
} from '../../core/validation/validation-errors';

/**
 * CONTRATO del recurso Ticket. Espejo 1:1 de ticketlistbe/src/modules/tickets/schemas/ticket.schema.ts
 * hasta que exista el paquete compartido (`@ticketit/contracts`) que importen front y BFF, así la regla "título de 3 a
 * 120 caracteres" se escribe UNA vez y vale igual en el formulario y en el endpoint.
 * Compárese con wallet-api, donde la misma regla está duplicada: `@MaxLength(30)` en el DTO de
 * class-validator y `maxLength: 30` en el `*-form.config.ts`.
 */

export const TICKET_STATUS = ['todo', 'in_progress', 'done'] as const;
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'] as const;
export const TICKET_CATEGORY = ['bug', 'feature', 'support', 'other'] as const;

/**
 * Fecha SIN hora ('YYYY-MM-DD' por JSON, `Date` desde el datepicker). No se usa `z.coerce.date()`
 * porque `new Date('2026-10-02')` es medianoche UTC y en America/* se ve como el día anterior.
 */
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

/** Campos editables, sin reglas cross-field (Zod 4 no permite `.extend()` sobre un objeto refinado). */
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
  category: z.enum(TICKET_CATEGORY, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una categoría' }),
  }),
  otherCategoryDetail: z
    .string()
    .trim()
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El detalle', max: 120 }) })
    .optional(),
  priority: z.enum(TICKET_PRIORITY, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una prioridad' }),
  }),
  status: z.enum(TICKET_STATUS, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un estado' }),
  }),
  assigneeEmail: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).or(z.literal('')),
  estimateHours: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(1, { error: msg(V.GENERIC.MIN_VALUE, { min: 1 }) })
    .max(200, { error: msg(V.GENERIC.MAX_VALUE, { max: 200 }) })
    .nullable(),
  dueDate: LocalDateSchema.nullable(),
  notifyReporter: z.boolean(),
});

/** Regla cross-field compartida por alta y edición (la valida también el BFF). */
const hasDetailWhenOther = (t: { category: string; otherCategoryDetail?: string }) =>
  t.category !== 'other' || !!t.otherCategoryDetail;
/**
 * `when` hace que la regla corra aunque otros campos sigan inválidos — por defecto Zod 4 salta los
 * refinements del objeto si algún campo falló (https://zod.dev/api#when).
 */
const otherNeedsDetail = {
  error: msg(V.TICKET.OTHER_CATEGORY_DETAIL_REQUIRED),
  path: ['otherCategoryDetail'],
  when: (payload: { value: unknown }) =>
    TicketBaseSchema.pick({ category: true, otherCategoryDetail: true }).safeParse(payload.value)
      .success,
};

/** PATCH (y formulario completo): todos los campos editables + regla cross-field. */
export const TicketUpsertSchema = TicketBaseSchema.refine(hasDetailWhenOther, otherNeedsDetail);

/**
 * POST: mismo contrato con defaults para lo que el alta rápida no envía. Un solo schema (no la
 * unión upsert | rápida): con la unión, un body completo pero inválido podía caer en la rama
 * «rápida» y perder campos en silencio. Espejo exacto del backend.
 */
export const TicketCreateSchema = TicketBaseSchema.extend({
  status: TicketBaseSchema.shape.status.default('todo'),
  assigneeEmail: TicketBaseSchema.shape.assigneeEmail.default(''),
  estimateHours: TicketBaseSchema.shape.estimateHours.default(null),
  dueDate: TicketBaseSchema.shape.dueDate.default(null),
  notifyReporter: TicketBaseSchema.shape.notifyReporter.default(false),
}).refine(hasDetailWhenOther, otherNeedsDetail);

/** Alta rápida (pantalla FormSplit): subconjunto del mismo contrato, no un schema paralelo. */
export const TicketQuickCreateSchema = TicketBaseSchema.pick({
  title: true,
  category: true,
  priority: true,
  description: true,
});

/** Recurso tal como lo devuelve `GET /api/tickets/:uuid` (campos de servidor incluidos). */
export const TicketSchema = TicketBaseSchema.extend({
  uuid: z.uuid(),
  code: z.string(),
  /** Titular: quien lo creó. Base de las reglas CASL de titular y de alternante. */
  ownerUuid: z.uuid(),
  createdAt: z.coerce.date(),
});

/**
 * `GET /api/bff/board` — forma EXACTA de la pantalla: columnas ya agrupadas y con su etiqueta.
 * El front no agrupa ni traduce estados: eso es responsabilidad del BFF.
 */
export const TicketBoardSchema = z.object({
  columns: z.array(
    z.object({
      status: z.enum(TICKET_STATUS),
      label: z.string(),
      tickets: z.array(TicketSchema),
    }),
  ),
});

/**
 * Inversa de `LocalDateSchema` para el REQUEST: `JSON.stringify(new Date())` produce un ISO en UTC
 * (`…T06:00:00.000Z`) que el backend rechaza/corre de día; se envía la fecha local 'YYYY-MM-DD'.
 */
export function toLocalIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
