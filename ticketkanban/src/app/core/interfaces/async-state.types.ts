import type { HttpErrorResponse } from '@angular/common/http';
import type { ResourceStatus } from '@angular/core';

/**
 * Estado de una operación asíncrona como unión discriminada sobre `kind` (port de wallet-api
 * `async-state.ts`): la UI hace `@switch` sobre `kind` en vez de combinar booleanos
 * (`isLoading && !error && data`…).
 */
export type TAsyncState<T, E = HttpErrorResponse> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; error: E };

/**
 * Mapea el `status()` de un `httpResource` a `TAsyncState`:
 *  - idle → idle · loading sin data previa → loading
 *  - loading con data previa / reloading / resolved / local → success (stale-while-revalidate)
 *  - error → error
 */
export function mapResourceState<T, E = HttpErrorResponse>(
  status: ResourceStatus,
  value: T | undefined,
  error: unknown,
): TAsyncState<T, E> {
  switch (status) {
    case 'error':
      return { kind: 'error', error: error as E };
    case 'resolved':
    case 'reloading':
    case 'local':
      return { kind: 'success', data: value as T };
    case 'loading':
      return value !== undefined ? { kind: 'success', data: value } : { kind: 'loading' };
    default:
      return { kind: 'idle' };
  }
}
