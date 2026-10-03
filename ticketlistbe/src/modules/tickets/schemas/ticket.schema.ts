import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { TICKET_STATUS } from '../lifecycle/ticket-lifecycle.js';

/**
 * CONTRATO del recurso Ticket — espejo 1:1 de ticketkanban/src/app/pages/tickets/ticket.schema.ts
 * hasta extraer el paquete compartido `@ticketit/contracts`. Mismas reglas y mismos mensajes: lo
 * que el formulario valida es exactamente lo que este backend valida.
 */
export { TICKET_STATUS };
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'] as const;
/** Tipo de incidencia o solicitud (CU05 paso 3). */
export const TICKET_TYPE = ['incident', 'service_request', 'inquiry', 'improvement'] as const;
/** Categoría funcional (CU05 paso 4). */
export const TICKET_CATEGORY = ['hardware', 'software', 'network', 'access', 'email', 'other'] as const;
/** Complejidad: la fija el equipo de soporte al clasificar; el cliente no la edita. */
export const TICKET_COMPLEXITY = ['simple', 'moderate', 'complex'] as const;

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
  type: z.enum(TICKET_TYPE, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un tipo' }) }),
  category: z.enum(TICKET_CATEGORY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una categoría' }) }),
  otherCategoryDetail: z
    .string()
    .trim()
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El detalle', max: 120 }) })
    .optional(),
  priority: z.enum(TICKET_PRIORITY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una prioridad' }) }),
  /** Solo el equipo la fija; si no se envía, se conserva. */
  complexity: z.enum(TICKET_COMPLEXITY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una complejidad' }) }).nullable().optional(),
  /**
   * Departamento de ORIGEN de la solicitud (código del catálogo `ticket-department`; `it` = solicitud interna de TI).
   * Los departamentos los administra un administrador, así que no es un enum: el servicio valida que el código exista
   * y esté activo (`STCK-E007`). Sin dato se asume `it`.
   */
  department: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un departamento' }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El departamento', max: 40 }) })
    .default('it'),
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
  assigneeEmail: TicketBaseSchema.shape.assigneeEmail.default(''),
  estimateHours: TicketBaseSchema.shape.estimateHours.default(null),
  dueDate: TicketBaseSchema.shape.dueDate.default(null),
  notifyReporter: TicketBaseSchema.shape.notifyReporter.default(false),
}).refine(hasDetailWhenOther, otherNeedsDetail);

/** Plazos y veredictos de SLA de un ticket (docs/standard/metrics.md §3). */
export const TicketSlaSchema = z.object({
  responseMinutes: z.number().int(),
  resolutionMinutes: z.number().int(),
  responseStatus: z.enum(['met', 'breached', 'pending']),
  resolutionStatus: z.enum(['met', 'breached', 'running', 'paused', 'escalated']),
  responseDueAt: z.iso.datetime(),
  /** `null` mientras el reloj está en pausa o el ticket escaló. */
  resolutionDueAt: z.iso.datetime().nullable(),
});

/** Respuesta: lo que viaja por JSON (fechas como string) — lo que parsea el front con `TicketSchema`. */
export const TicketResponseSchema = TicketBaseSchema.extend({
  uuid: z.uuid(),
  /** Titular (creador/solicitante): la base de las reglas de dueño y de lo que comparte. */
  ownerUuid: z.uuid(),
  requesterName: z.string(),
  code: z.string(),
  complexity: z.enum(TICKET_COMPLEXITY).nullable(),
  /** Desde cuándo está en atención (asignado o en curso): arranca el reloj de la tarjeta. `null` en otros estados. */
  attendedSince: z.iso.datetime().nullable(),
  status: z.enum(TICKET_STATUS),
  /** Quién atiende el caso (nombre), para que el solicitante lo sepa; `null` sin responsable. */
  assigneeName: z.string().nullable(),
  dueDate: z.iso.date().nullable(),
  resolution: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  closedAt: z.iso.datetime().nullable(),
  reopenCount: z.number().int(),
  sla: TicketSlaSchema,
  /** Estados a los que ESTA persona puede mover el ticket ahora (arma los botones de la pantalla). */
  nextStatuses: z.array(z.enum(TICKET_STATUS)),
  createdAt: z.iso.datetime(),
});

export const TicketFilterSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
  type: z.enum(TICKET_TYPE).optional(),
  category: z.enum(TICKET_CATEGORY).optional(),
  department: z.string().trim().min(1).max(40).optional(),
  /** `true`: solo los tickets que registró quien consulta («Mis tickets», CU01). */
  mine: z.enum(['true']).optional(),
});
