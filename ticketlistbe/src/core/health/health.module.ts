import { Module, type OnApplicationShutdown, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { HealthController } from './health.controller.js';

/** Tiempo máximo para que las requests en vuelo terminen antes de cortar las conexiones. */
export const DRAIN_TIMEOUT_MS = 10_000;

/**
 * Apagado ordenado (SIGTERM del orquestador, requiere `app.enableShutdownHooks()`): se dejan de
 * aceptar conexiones nuevas, se cierran las ociosas y a las que siguen en vuelo se les da
 * `DRAIN_TIMEOUT_MS` antes de cortarlas. El almacén clave-valor y los streams SSE cierran en sus
 * propios `onApplicationShutdown` (KvModule, NotificationStreamService).
 */
@Module({ controllers: [HealthController] })
export class HealthModule implements OnApplicationShutdown {
  private readonly logger = new Logger('Shutdown');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  onApplicationShutdown(signal?: string): void {
    this.logger.log(`Apagado ordenado (${signal ?? 'sin señal'})`);
    const server = this.httpAdapterHost.httpAdapter?.getHttpServer() as
      | { closeIdleConnections?: () => void; closeAllConnections?: () => void }
      | undefined;
    server?.closeIdleConnections?.();
    const timer = setTimeout(() => {
      server?.closeAllConnections?.();
      this.logger.warn('Conexiones restantes cerradas a la fuerza');
    }, DRAIN_TIMEOUT_MS);
    // No debe mantener vivo el proceso si ya no hay nada que esperar.
    timer.unref();
  }
}
