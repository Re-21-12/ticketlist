import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { filter, interval, map, merge, Subject, takeUntil, type Observable } from 'rxjs';
import type * as z from 'zod';
import type { NotificationResponseSchema } from './schemas/notification.schema.js';

type TNotificationResponse = z.output<typeof NotificationResponseSchema>;

/** Mensaje SSE (`MessageEvent` de Nest): `type` es el nombre del evento que escucha `EventSource`. */
export interface INotificationStreamMessage {
  type: 'notification' | 'ping';
  data: object;
}

/** Cada cuánto se manda un latido: sin tráfico, Traefik y los proxies cortan una conexión ociosa. */
export const HEARTBEAT_MS = 25_000;

/**
 * Tiempo real de las notificaciones (CU01): `NotificationsService.notify()` publica aquí cada notificación YA
 * guardada y `GET /api/notifications/stream` (SSE) se la entrega solo a su destinatario. La entrega es por proceso:
 * con una sola réplica de la API es completa; con varias habría que publicar por Redis (ver docs/standard/notifications.md).
 * La bandeja del front sigue consultando cada minuto como respaldo si el stream se cae.
 */
@Injectable()
export class NotificationStreamService implements OnApplicationShutdown {
  private readonly published = new Subject<{ recipientUuid: string; notification: TNotificationResponse }>();
  private readonly closing = new Subject<void>();

  publish(recipientUuid: string, notification: TNotificationResponse): void {
    this.published.next({ recipientUuid, notification });
  }

  /** Stream de UNA persona: sus notificaciones + un latido periódico. Termina al apagar la API. */
  streamFor(userUuid: string): Observable<INotificationStreamMessage> {
    const mine = this.published.pipe(
      filter((event) => event.recipientUuid === userUuid),
      map((event): INotificationStreamMessage => ({ type: 'notification', data: event.notification })),
    );
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): INotificationStreamMessage => ({ type: 'ping', data: {} })));
    return merge(mine, heartbeat).pipe(takeUntil(this.closing));
  }

  /** Cierra todos los streams abiertos: sin esto una conexión SSE impide que el servidor HTTP termine. */
  onApplicationShutdown(): void {
    this.closing.next();
    this.closing.complete();
    this.published.complete();
  }
}
