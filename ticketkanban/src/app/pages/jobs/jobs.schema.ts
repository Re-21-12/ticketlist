import { z } from 'zod';

/** Plazo del cierre automático: de 1 hora a 30 días (espejo de `jobs.schema.ts` del backend). */
export const AFTER_HOURS_MIN = 1;
export const AFTER_HOURS_MAX = 720;

/** Una tarea programada tal como la devuelve `GET /api/jobs`. */
export const JobSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  cron: z.string(),
  params: z.object({ afterHours: z.number().int().optional() }),
  lastRunAt: z.coerce.date().nullable(),
  lastRunStatus: z.enum(['ok', 'error']).nullable(),
  lastRunSummary: z.string().nullable(),
  /** `schedule` (por el reloj) o el correo de quien la ejecutó a mano. */
  lastRunTrigger: z.string().nullable(),
  /** Próxima corrida programada; `null` si está desactivada. */
  nextRunAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
  updatedBy: z.string().nullable(),
});

export const JobListSchema = z.object({ data: z.array(JobSchema) });
