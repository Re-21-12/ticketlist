import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * Signal que sigue una media query (`(max-width: 767px)`). Se llama en un contexto de inyección
 * (campo de un componente o servicio): se desuscribe sola al destruirse. Sin `matchMedia` (SSR, tests
 * sin DOM) devuelve `initial`.
 */
export function mediaQuerySignal(query: string, initial = false): Signal<boolean> {
  const state = signal(initial);
  if (typeof matchMedia !== 'function') return state.asReadonly();
  const list = matchMedia(query);
  state.set(list.matches);
  const onChange = (event: MediaQueryListEvent) => state.set(event.matches);
  list.addEventListener('change', onChange);
  inject(DestroyRef).onDestroy(() => list.removeEventListener('change', onChange));
  return state.asReadonly();
}
