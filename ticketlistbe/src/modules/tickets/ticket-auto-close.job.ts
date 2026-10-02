import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';
import { TicketLifecycleService } from './ticket-lifecycle.service.js';

/** Cada cuánto se revisa si hay «Resuelto» vencidos (la regla de 48 h es de la historia A4). */
const CHECK_EVERY_MS = 10 * 60_000;

/**
 * Cierre automático de tickets «Resuelto» sin respuesta del solicitante. Corre en el propio proceso
 * (suficiente con UNA réplica; con varias, mover a un cron/cola para que no corran todas a la vez). Los
 * tests llaman `TicketLifecycleService.closeStaleResolved(now)` directamente, sin esperar al reloj.
 */
@Injectable()
export class TicketAutoCloseJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('AutoClose');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly lifecycle: TicketLifecycleService,
    @Inject(APP_ENV) private readonly env: TEnv,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      try {
        const closed = this.lifecycle.closeStaleResolved();
        if (closed) this.logger.log(`Cerró ${closed} ticket(s) sin respuesta tras 48 h`);
      } catch (error) {
        this.logger.error('Falló el cierre automático', error);
      }
    }, CHECK_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
