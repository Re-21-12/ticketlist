import { inject, Service, signal } from '@angular/core';
import { filter, Subject, type Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationSchema } from '../../pages/profile/profile.schema';
import type { TNotification } from '../../pages/profile/profile.types';
import { mockRealtime$, mockRealtimeState } from '../mock-bff/mock-realtime';
import { SessionStore } from '../session/session.store';

/** Estado de la conexión en tiempo real: `offline` dispara la alerta de sincronización (A2 de CU01). */
export type TStreamState = 'idle' | 'connecting' | 'live' | 'offline';

const STREAM_URL = '/api/notifications/stream';

/**
 * Tiempo real de las notificaciones (CU01): una conexión SSE (`EventSource`) a `GET /api/notifications/stream`. Cada
 * notificación nueva llega por `events$`; si la conexión se cae, `$state` pasa a `offline` (el navegador reintenta
 * solo) y, al volver, `reconnected$` avisa para que quien escucha recupere lo que se pudo perder. En modo mock no hay
 * servidor: se escucha el canal simulado del mock BFF. `connect()` es idempotente.
 */
@Service()
export class NotificationStreamService {
  private readonly _session = inject(SessionStore);
  private readonly $_state = signal<TStreamState>('idle');
  readonly $state = this.$_state.asReadonly();

  private readonly _events = new Subject<TNotification>();
  private readonly _reconnected = new Subject<void>();
  readonly events$ = this._events.asObservable();
  readonly reconnected$ = this._reconnected.asObservable();

  private _source: EventSource | null = null;
  private _mockSubscription: Subscription | null = null;

  connect(): void {
    if (this._source || this._mockSubscription) return;
    this.$_state.set('connecting');
    if (environment.useMockBff) {
      this.connectMock();
      return;
    }
    if (typeof EventSource === 'undefined') {
      this.$_state.set('offline');
      return;
    }
    let everOpened = false;
    const source = new EventSource(STREAM_URL, { withCredentials: true });
    source.onopen = () => {
      // Un `open` posterior al primero = se reconectó tras una caída: hay que recuperar lo perdido.
      if (everOpened) this._reconnected.next();
      everOpened = true;
      this.$_state.set('live');
    };
    source.onerror = () => this.$_state.set('offline');
    source.addEventListener('notification', (event) => {
      try {
        const parsed = NotificationSchema.safeParse(JSON.parse((event as MessageEvent<string>).data));
        if (parsed.success) this._events.next(parsed.data);
      } catch {
        // Un mensaje mal formado no debe tumbar el canal.
      }
    });
    this._source = source;
  }

  disconnect(): void {
    this._source?.close();
    this._source = null;
    this._mockSubscription?.unsubscribe();
    this._mockSubscription = null;
    this.$_state.set('idle');
  }

  /** Cierra y vuelve a abrir (otra cuenta inició sesión, o «Actualizar» tras una caída permanente). */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  private connectMock(): void {
    this._mockSubscription = mockRealtime$
      .pipe(filter((event) => event.recipientUuid === this._session.$user()?.uuid))
      .subscribe((event) => {
        if (mockRealtimeState.offline) return; // «sin conexión»: el aviso no llega en vivo
        const parsed = NotificationSchema.safeParse(event.notification);
        if (parsed.success) this._events.next(parsed.data);
      });
    this.$_state.set(mockRealtimeState.offline ? 'offline' : 'live');
  }
}
