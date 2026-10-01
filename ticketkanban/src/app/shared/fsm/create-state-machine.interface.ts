import type { Signal } from '@angular/core';

export interface ICreateStateMachineOptions<TS extends string, TE extends string> {
  /** Estado inicial — debe estar incluido en `states`. */
  initial: TS;
  /** Lista cerrada de estados válidos. En dev se valida que todos los destinos existan. */
  states: readonly TS[];
  /** Tabla de transiciones: origen → { evento → destino }. */
  transitions: Record<TS, Partial<Record<TE, TS>>>;
  /** Guardas opcionales `<origen>.<evento>`: si devuelven `false`, `send()` no transiciona. */
  guards?: Partial<Record<`${TS}.${TE}`, () => boolean>>;
}

export interface IStateMachine<TS extends string, TE extends string> {
  /** Estado actual, SOLO lectura: toda mutación pasa por `send()`. */
  readonly $state: Signal<TS>;
  /** ¿`event` es una transición válida (con guard aprobada) desde el estado actual? */
  can(event: TE): boolean;
  is(state: TS): boolean;
  /** Transiciona si existe y su guard pasa. `true` si cambió; nunca lanza. */
  send(event: TE): boolean;
}
