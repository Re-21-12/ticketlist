import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { DEFAULT_CALENDAR } from '../tickets/sla/business-calendar.js';
import { AUTO_CLOSE_AFTER_HOURS } from '../tickets/lifecycle/ticket-lifecycle.js';
import { TicketLifecycleService } from '../tickets/ticket-lifecycle.service.js';
import { cronMatches, parseCron } from './cron-expression.js';
import { JobsRepository } from './jobs.repository.js';
import type { JobResponseSchema, JobUpdateSchema } from './jobs.schema.js';
import { AUTO_CLOSE_JOB_KEY, type IJobParams, type IScheduledJob } from './scheduled-job.entity.js';

type TJobResponse = z.output<typeof JobResponseSchema>;
type TJobUpdate = z.output<typeof JobUpdateSchema>;
/** La lógica de una tarea: recibe sus parámetros y devuelve un resumen legible de lo que hizo. */
type TJobHandler = (params: IJobParams, now: Date) => string;

const MINUTE_MS = 60_000;
/** Cada cuánto se mira el reloj; la precisión de un cron es de un minuto. */
const TICK_MS = 30_000;
/** Cuánto hacia adelante se busca la próxima corrida (un año cubre cualquier cron razonable). */
const LOOKAHEAD_MINUTES = 366 * 24 * 60;

/**
 * Tareas programadas CONFIGURABLES por un administrador (pantalla «Tareas programadas»). El planificador corre en el propio
 * proceso: cada 30 s revisa las tareas activas y ejecuta las que su cron marca para este minuto (una vez por minuto). Con
 * UNA réplica de la API es suficiente; con varias correrían todas a la vez (habría que mover esto a una cola o tomar un candado
 * en Redis). Los tests llaman `tick(now)` / `run(key)` directamente, sin esperar al reloj.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private timer: NodeJS.Timeout | null = null;
  private readonly running = new Set<string>();
  private readonly handlers: Record<string, TJobHandler>;

  constructor(
    private readonly repository: JobsRepository,
    lifecycle: TicketLifecycleService,
    @Inject(APP_ENV) private readonly env: TEnv,
  ) {
    this.handlers = {
      [AUTO_CLOSE_JOB_KEY]: (params, now) => {
        const hours = params.afterHours ?? AUTO_CLOSE_AFTER_HOURS;
        const closed = lifecycle.closeStaleResolved(now, hours);
        return closed === 0
          ? `Ningún ticket «Resuelto» llevaba más de ${hours} h sin respuesta`
          : `Cerró ${closed} ticket(s) «Resuelto» sin respuesta tras ${hours} h y envió la encuesta a su buzón`;
      },
    };
  }

  onModuleInit(): void {
    // En pruebas no hay reloj: se llama a `tick()` a mano.
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  list(now = new Date()): TJobResponse[] {
    return this.repository.list().map((job) => this.toResponse(job, now));
  }

  update(key: string, dto: TJobUpdate, now = new Date()): TJobResponse {
    const job = this.require(key);
    const saved: IScheduledJob = {
      ...job,
      enabled: dto.enabled,
      cron: dto.cron,
      params: { ...job.params, ...(dto.params.afterHours !== undefined ? { afterHours: dto.params.afterHours } : {}) },
      updatedAt: now,
      updatedBy: RequestContext.currentUser()?.email ?? null,
    };
    this.repository.save(saved);
    return this.toResponse(saved, now);
  }

  /** «Ejecutar ahora»: corre la tarea a petición de quien la administra. Devuelve la tarea con su última corrida. */
  run(key: string, trigger: string = RequestContext.currentUser()?.email ?? 'manual', now = new Date()): TJobResponse {
    const job = this.require(key);
    return this.toResponse(this.execute(job, trigger, now), now);
  }

  /** Una vuelta del planificador: ejecuta las tareas activas cuyo cron coincide con este minuto (y no corrieron ya en él). */
  tick(now = new Date()): number {
    let executed = 0;
    for (const job of this.repository.list()) {
      if (!job.enabled) continue;
      const cron = parseCron(job.cron);
      if (!cron || !cronMatches(cron, now, DEFAULT_CALENDAR.utcOffsetMinutes)) continue;
      if (job.lastRunAt && Math.floor(job.lastRunAt.getTime() / MINUTE_MS) === Math.floor(now.getTime() / MINUTE_MS)) continue;
      this.execute(job, 'schedule', now);
      executed += 1;
    }
    return executed;
  }

  private execute(job: IScheduledJob, trigger: string, now: Date): IScheduledJob {
    const handler = this.handlers[job.key];
    if (!handler) throw new CustomBusinessException(ERROR_CODES.JOB.NOT_FOUND, { entity: 'ScheduledJob', value: job.key });
    // Una tarea no se ejecuta dos veces a la vez (p. ej. «Ejecutar ahora» mientras el reloj la corre).
    if (this.running.has(job.key)) return job;
    this.running.add(job.key);
    let status: 'ok' | 'error' = 'ok';
    let summary: string;
    try {
      summary = handler(job.params, now);
    } catch (error) {
      status = 'error';
      summary = `Falló: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300);
      this.logger.error(`La tarea «${job.key}» falló`, error);
    } finally {
      this.running.delete(job.key);
    }
    const saved: IScheduledJob = { ...job, lastRunAt: now, lastRunStatus: status, lastRunSummary: summary.slice(0, 300), lastRunTrigger: trigger };
    this.repository.save(saved);
    if (status === 'ok') this.logger.log(`«${job.key}» (${trigger}): ${summary}`);
    return saved;
  }

  private require(key: string): IScheduledJob {
    const job = this.repository.find(key);
    if (!job) throw new CustomBusinessException(ERROR_CODES.JOB.NOT_FOUND, { entity: 'ScheduledJob', value: key });
    return job;
  }

  /** Próxima corrida: el primer minuto futuro en que el cron coincide (hasta un año adelante). */
  private nextRun(job: IScheduledJob, now: Date): Date | null {
    if (!job.enabled) return null;
    const cron = parseCron(job.cron);
    if (!cron) return null;
    const start = Math.floor(now.getTime() / MINUTE_MS) + 1;
    for (let i = 0; i < LOOKAHEAD_MINUTES; i++) {
      const candidate = new Date((start + i) * MINUTE_MS);
      if (cronMatches(cron, candidate, DEFAULT_CALENDAR.utcOffsetMinutes)) return candidate;
    }
    return null;
  }

  private toResponse(job: IScheduledJob, now: Date): TJobResponse {
    return {
      key: job.key,
      name: job.name,
      description: job.description,
      enabled: job.enabled,
      cron: job.cron,
      params: job.params,
      lastRunAt: job.lastRunAt?.toISOString() ?? null,
      lastRunStatus: job.lastRunStatus,
      lastRunSummary: job.lastRunSummary,
      lastRunTrigger: job.lastRunTrigger,
      nextRunAt: this.nextRun(job, now)?.toISOString() ?? null,
      updatedAt: job.updatedAt.toISOString(),
      updatedBy: job.updatedBy,
    };
  }
}
