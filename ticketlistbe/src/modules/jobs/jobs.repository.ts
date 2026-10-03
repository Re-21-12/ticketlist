import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ScheduledJobSchema } from '../../database/entity-schemas.js';
import { PersistenceService } from '../../database/persistence.service.js';
import { AUTO_CLOSE_JOB_KEY, type IScheduledJob } from './scheduled-job.entity.js';

/** Tareas que existen por defecto. El código de cada una vive en `JobsService`; aquí solo su configuración inicial. */
export function defaultJobs(now = new Date()): IScheduledJob[] {
  return [
    {
      key: AUTO_CLOSE_JOB_KEY,
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
      updatedAt: now,
      updatedBy: null,
    },
  ];
}

/**
 * Configuración de las tareas programadas. Se hidrata de Postgres y, como el resto de semillas, solo AGREGA las tareas
 * que falten (por `key`): lo que un administrador cambió (cron, plazo, activada) nunca se pisa.
 */
@Injectable()
export class JobsRepository implements OnModuleInit {
  private jobs: IScheduledJob[] = defaultJobs();

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    const stored = await this.persistence.load(ScheduledJobSchema);
    const known = new Set(stored.map((job) => job.key));
    const missing = this.jobs.filter((job) => !known.has(job.key));
    if (missing.length > 0) this.persistence.save(ScheduledJobSchema, missing);
    this.jobs = [...stored, ...missing];
  }

  list(): IScheduledJob[] {
    return this.jobs.map((job) => ({ ...job, params: { ...job.params } }));
  }

  find(key: string): IScheduledJob | null {
    const found = this.jobs.find((job) => job.key === key);
    return found ? { ...found, params: { ...found.params } } : null;
  }

  save(job: IScheduledJob): void {
    this.jobs = this.jobs.map((existing) => (existing.key === job.key ? job : existing));
    this.persistence.save(ScheduledJobSchema, job);
  }
}
