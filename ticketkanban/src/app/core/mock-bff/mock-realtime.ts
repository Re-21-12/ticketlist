import { Subject } from 'rxjs';

/** Una notificación nueva, ya con destinatario (lo que el backend empuja por SSE a quien tenga el stream abierto). */
export interface IMockRealtimeEvent {
  recipientUuid: string;
  notification: unknown;
}

/**
 * Tiempo real del mock: el handler publica aquí cada notificación nueva y `NotificationStreamService` (en modo mock)
 * la recibe en lugar de abrir un `EventSource`. Así el flujo de CU01 se puede probar sin backend: cambiar de rol,
 * mover un ticket y ver llegar el aviso al solicitante. Solo `rxjs`: no arrastra el resto del mock al bundle inicial.
 */
export const mockRealtime$ = new Subject<IMockRealtimeEvent>();

/** Interruptor para probar la alerta de sincronización (A2): con `true` el stream simulado se «cae». */
export const mockRealtimeState = { offline: false };
