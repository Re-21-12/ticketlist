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

/** Ciclo de vida (espejo de `lifecycle/ticket-lifecycle.ts` del backend; docs/standard/metrics.md §2). */
export const TICKET_STATUS = [
  'new',
  'assigned',
  'in_progress',
  'pending_customer',
  'escalated',
  'resolved',
  'closed',
  'reopened',
] as const;
export const TICKET_PRIORITY = ['low', 'medium', 'high', 'critical'] as const;
/** Tipo de incidencia o solicitud (CU05, paso 3). */
export const TICKET_TYPE = ['incident', 'service_request', 'inquiry', 'improvement'] as const;
/** Categoría funcional (CU05, paso 4). */
export const TICKET_CATEGORY = ['hardware', 'software', 'network', 'access', 'email', 'other'] as const;
/** Complejidad: la fija el equipo de soporte; el cliente no la edita. */
export const TICKET_COMPLEXITY = ['simple', 'moderate', 'complex'] as const;
/** Los estados son variaciones de tres grandes (el tablero tiene tres columnas). */
export const TICKET_STATUS_GROUPS = ['new', 'in_attention', 'closed'] as const;

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
  type: z.enum(TICKET_TYPE, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un tipo' }),
  }),
  category: z.enum(TICKET_CATEGORY, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una categoría' }),
  }),
  otherCategoryDetail: z
    .string()
    .trim()
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El detalle', max: 120 }) })
    .optional(),
  /** Departamento de ORIGEN (código del catálogo editable `ticket-department`; `it` = solicitud interna de TI). */
  department: z
    .string({ error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un departamento' }) })
    .trim()
    .min(1, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un departamento' }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El departamento', max: 40 }) }),
  priority: z.enum(TICKET_PRIORITY, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una prioridad' }),
  }),
  /** Solo el equipo la fija; si no se envía, se conserva. */
  complexity: z
    .enum(TICKET_COMPLEXITY, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una complejidad' }) })
    .nullable()
    .optional(),
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
  // Como el backend: sin dato se asume una solicitud interna de TI.
  department: TicketBaseSchema.shape.department.default('it'),
  assigneeEmail: TicketBaseSchema.shape.assigneeEmail.default(''),
  estimateHours: TicketBaseSchema.shape.estimateHours.default(null),
  dueDate: TicketBaseSchema.shape.dueDate.default(null),
  notifyReporter: TicketBaseSchema.shape.notifyReporter.default(false),
}).refine(hasDetailWhenOther, otherNeedsDetail);

/** Alta rápida (pantalla FormSplit): subconjunto del mismo contrato, no un schema paralelo. */
export const TicketQuickCreateSchema = TicketBaseSchema.pick({
  title: true,
  type: true,
  department: true,
  category: true,
  priority: true,
  description: true,
});

/** Persona asignable: `GET /api/users/assignable` (espejo de `AssignableUserListSchema` del backend). */
export const AssigneeListSchema = z.object({
  data: z.array(z.object({ uuid: z.uuid(), name: z.string(), email: z.email(), role: z.string() })),
});

/** Plazos y veredictos de SLA (espejo de `TicketSlaSchema` del backend). */
export const TicketSlaSchema = z.object({
  responseMinutes: z.number().int(),
  resolutionMinutes: z.number().int(),
  responseStatus: z.enum(['met', 'breached', 'pending']),
  resolutionStatus: z.enum(['met', 'breached', 'running', 'paused', 'escalated']),
  responseDueAt: z.coerce.date(),
  /** `null` mientras el reloj está en pausa o el ticket escaló. */
  resolutionDueAt: z.coerce.date().nullable(),
});

/** Recurso tal como lo devuelve `GET /api/tickets/:uuid` (campos de servidor incluidos). */
export const TicketSchema = TicketBaseSchema.extend({
  uuid: z.uuid(),
  code: z.string(),
  /** Titular/solicitante: quien lo creó. Base de las reglas CASL de titular y de alternante. */
  ownerUuid: z.uuid(),
  requesterName: z.string(),
  complexity: z.enum(TICKET_COMPLEXITY).nullable(),
  /** Desde cuándo está en atención (arranca el reloj de la tarjeta); `null` en otros estados. */
  attendedSince: z.coerce.date().nullable(),
  status: z.enum(TICKET_STATUS),
  /** Quién atiende el caso, para que el solicitante lo sepa; `null` sin responsable. */
  assigneeName: z.string().nullable(),
  resolution: z.string().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  closedAt: z.coerce.date().nullable(),
  reopenCount: z.number().int(),
  sla: TicketSlaSchema,
  /** Estados a los que ESTA persona puede mover el ticket ahora (arma los botones y el arrastre). */
  nextStatuses: z.array(z.enum(TICKET_STATUS)),
  createdAt: z.coerce.date(),
});

/** Cambio de estado (`POST /api/tickets/:uuid/transitions`). Resolver exige documentar la solución. */
export const TicketTransitionSchema = z
  .object({
    to: z.enum(TICKET_STATUS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un estado' }) }),
    note: z.string().trim().max(500, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La nota', max: 500 }) }).optional(),
    resolution: z.string().trim().max(2000, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La solución', max: 2000 }) }).optional(),
    /** Evidencia ya subida (fotos de la solución…) que acompaña al cambio de estado. */
    attachmentIds: z.array(z.uuid()).max(5).optional(),
  })
  .refine((value) => value.to !== 'resolved' || (value.resolution?.length ?? 0) >= 3, {
    error: msg(V.TICKET.RESOLUTION_REQUIRED),
    path: ['resolution'],
  });

/** Formulario del modal «Resolver»: solo la solución (el estado destino lo fija la acción). */
export const TicketResolveFormSchema = z.object({
  resolution: z
    .string()
    .trim()
    .min(3, { error: msg(V.TICKET.RESOLUTION_REQUIRED) })
    .max(2000, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La solución', max: 2000 }) }),
});

/**
 * `GET /api/bff/board` — forma EXACTA de la pantalla: columnas ya agrupadas y con su etiqueta.
 * El front no agrupa ni traduce estados: eso es responsabilidad del BFF.
 */
export const TicketBoardSchema = z.object({
  columns: z.array(
    z.object({
      group: z.enum(TICKET_STATUS_GROUPS),
      label: z.string(),
      /** Estados que caen en la columna, en orden de flujo. */
      statuses: z.array(z.enum(TICKET_STATUS)),
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

/** Calificación del servicio al cerrarse un ticket (CSAT, escala 1–5). Espejo de `SurveyAnswerSchema` / `SurveyStateSchema` del backend. */
export const SURVEY_SCORES = [1, 2, 3, 4, 5] as const;
export const SurveyFormSchema = z.object({
  /** ¿Se resolvió el problema? El formulario usa «yes»/«no» (radios); al enviar se convierte a boolean. */
  resolved: z.enum(['yes', 'no'], { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'si se resolvió el problema' }) }),
  score: z.number({ error: msg(V.TICKET.SURVEY_SCORE) }).int({ error: msg(V.TICKET.SURVEY_SCORE) }).min(1, { error: msg(V.TICKET.SURVEY_SCORE) }).max(5, { error: msg(V.TICKET.SURVEY_SCORE) }),
  comment: z.string().trim().max(500, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El comentario', max: 500 }) }),
});
export const SurveyStateSchema = z.object({
  state: z.enum(['pending', 'answered', 'expired']),
  expiresAt: z.coerce.date(),
  score: z.number().int().nullable(),
  comment: z.string().nullable(),
  /** ¿Se resolvió el problema? `null` hasta que responde. */
  resolved: z.boolean().nullable(),
});
