import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../common/codes/validation-errors.js';
import { parseCron } from './cron-expression.js';

/** Plazo (en horas) del cierre automático: de 1 hora a 30 días. */
export const AFTER_HOURS_MIN = 1;
export const AFTER_HOURS_MAX = 720;

export const JobParamsSchema = z.strictObject({
  afterHours: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(AFTER_HOURS_MIN, { error: msg(V.GENERIC.MIN_VALUE, { min: AFTER_HOURS_MIN }) })
    .max(AFTER_HOURS_MAX, { error: msg(V.GENERIC.MAX_VALUE, { max: AFTER_HOURS_MAX }) })
    .optional(),
});

/** Lo que un administrador puede cambiar de una tarea: si corre, cuándo (cron) y sus parámetros. */
export const JobUpdateSchema = z.strictObject({
  enabled: z.boolean(),
  cron: z
    .string()
    .trim()
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La expresión cron', max: 120 }) })
    .refine((value) => parseCron(value) !== null, { error: msg(V.JOB.CRON_INVALID) }),
  params: JobParamsSchema.default({}),
});

export const JobResponseSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  cron: z.string(),
  params: z.object({ afterHours: z.number().int().optional() }),
  lastRunAt: z.iso.datetime().nullable(),
  lastRunStatus: z.enum(['ok', 'error']).nullable(),
  lastRunSummary: z.string().nullable(),
  lastRunTrigger: z.string().nullable(),
  /** Próxima corrida programada (hora del servidor, ISO); `null` si está desactivada. */
  nextRunAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  updatedBy: z.string().nullable(),
});

export const JobListSchema = z.object({ data: z.array(JobResponseSchema) });

export const JobKeyParamSchema = z.object({ key: z.string().min(1).max(60) });
