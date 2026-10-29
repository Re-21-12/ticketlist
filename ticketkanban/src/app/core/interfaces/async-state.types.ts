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

/** Lo mínimo que `mapResource` lee de un `httpResource` (lo cumple cualquier recurso de Angular; las pruebas usan uno de mentira). */
export interface IResourceLike<T> {
  status(): ResourceStatus;
  error(): unknown;
  hasValue(): boolean;
  value(): T | undefined;
}

/**
 * Mapea un `httpResource` a `TAsyncState`:
 *  - idle → idle · error → error
 *  - con valor (resolved, reloading o loading con data previa) → success (stale-while-revalidate)
 *  - SIN valor (primera carga, o recargando después de un error) → loading
 *
 * Recibe el RECURSO y no sus tres lecturas: en el estado de error `value()` LANZA (`ResourceValueError`), así que leerlo
 * por adelantado rompía el computed; y tras un error + recarga el estado es `reloading` SIN valor, que antes se devolvía
 * como `success` con `data` indefinido (el `state.data.data` de las pantallas fallaba con «e.data is undefined»).
 */
export function mapResource<T, E = HttpErrorResponse>(resource: IResourceLike<T>): TAsyncState<T, E> {
  const status = resource.status();
  if (status === 'idle') return { kind: 'idle' };
  if (status === 'error') return { kind: 'error', error: resource.error() as E };
  const value = resource.hasValue() ? resource.value() : undefined;
  return value === undefined ? { kind: 'loading' } : { kind: 'success', data: value };
}
