import { nextCronRun } from '../../pages/jobs/cron.util';

/** Una tarea programada del mock (espejo de `IScheduledJob` del backend, con las fechas ya en ISO). */
export interface IMockJob {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  cron: string;
  params: { afterHours?: number };
  lastRunAt: string | null;
  lastRunStatus: 'ok' | 'error' | null;
  lastRunSummary: string | null;
  lastRunTrigger: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

/** Zona del calendario hábil del servicio (UTC−6): en ella se interpreta el cron. */
export const MOCK_CRON_OFFSET_MINUTES = -360;
export const MOCK_AUTO_CLOSE_KEY = 'ticket-auto-close';

export function seedJobs(): IMockJob[] {
  return [
    {
      key: MOCK_AUTO_CLOSE_KEY,
      name: 'Cierre automático de tickets resueltos',
      description:
        'Cierra los tickets en «Resuelto» cuyo solicitante no respondió pasado el plazo y deja en su buzón la encuesta de satisfacción (¿se resolvió el problema?, calificación y comentario opcional).',
      enabled: true,
      cron: '*/10 * * * *',
      params: { afterHours: 48 },
      lastRunAt: null,
      lastRunStatus: null,
      lastRunSummary: null,
      lastRunTrigger: null,
      updatedAt: '2026-09-01T00:00:00.000Z',
      updatedBy: null,
    },
  ];
}

/** La tarea tal como la devuelve `GET /api/jobs`: con su próxima corrida (o `null` si está desactivada). */
export function jobResponse(job: IMockJob, now = new Date()): IMockJob & { nextRunAt: string | null } {
  return { ...job, nextRunAt: job.enabled ? (nextCronRun(job.cron, now, MOCK_CRON_OFFSET_MINUTES)?.toISOString() ?? null) : null };
}
