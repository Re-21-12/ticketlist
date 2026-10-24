import type { ResourceStatus } from '@angular/core';
import { mapResource, type IResourceLike } from './async-state.types';

type TStatus = 'idle' | 'loading' | 'reloading' | 'resolved' | 'local' | 'error';

/** Un recurso de mentira que imita a `httpResource`: en el estado de error `value()` LANZA, como en Angular 22. */
function fakeResource<T>(status: TStatus, value?: T, error?: Error): IResourceLike<T> {
  return {
    status: () => status as ResourceStatus,
    error: () => error,
    hasValue: () => status !== 'error' && value !== undefined,
    value: () => {
      if (status === 'error') throw new Error('Resource is currently in an error state');
      return value;
    },
  };
}

describe('mapResource', () => {
  it('idle → idle', () => {
    expect(mapResource(fakeResource('idle'))).toEqual({ kind: 'idle' });
  });

  it('la primera carga (sin valor) es loading', () => {
    expect(mapResource(fakeResource('loading'))).toEqual({ kind: 'loading' });
  });

  it('con valor: resolved, reloading y loading con datos previos son success (se sigue viendo lo anterior)', () => {
    for (const status of ['resolved', 'reloading', 'loading', 'local'] as const) {
      expect(mapResource(fakeResource(status, { data: [1] }))).toEqual({ kind: 'success', data: { data: [1] } });
    }
  });

  it('error → error SIN leer value() (que lanza en ese estado)', () => {
    const boom = new Error('401');
    expect(mapResource(fakeResource('error', undefined, boom))).toEqual({ kind: 'error', error: boom });
  });

  it('recargar DESPUÉS de un error (reloading sin valor) es loading, nunca success con data indefinido', () => {
    const state = mapResource(fakeResource<{ data: number[] }>('reloading'));
    expect(state).toEqual({ kind: 'loading' });
  });
});
