import { isDevMode, signal } from '@angular/core';
import type { ICreateStateMachineOptions, IStateMachine } from './create-state-machine.interface';

/**
 * Máquina de estados finitos sobre signals (port de wallet-api, ver su `docs/standard/fsm.md`).
 *
 * Para operaciones multi-paso (guardar, subir, analizar…): en vez de varios `signal(boolean)`
 * (`saving`, `error`, `done`) que pueden contradecirse, un único `$state` cuyas transiciones se
 * validan contra una tabla. Un evento no declarado desde el estado actual se ignora (`false` +
 * `console.warn` en dev): la máquina NUNCA queda en un estado inválido. Los booleanos que usa el
 * template se DERIVAN con `computed(() => machine.is('saving'))` y ya no pueden mentir.
 *
 * Reglas: estados en camelCase (`'saving'`), eventos en SNAKE_CASE (`'SUBMIT'`); la máquina
 * modela el ciclo de vida, los DATOS de la operación viven en signals aparte.
 */
export function createStateMachine<TS extends string, TE extends string>(
  options: ICreateStateMachineOptions<TS, TE>,
): IStateMachine<TS, TE> {
  assertValidConfig(options);

  const { initial, transitions } = options;
  const guards: NonNullable<ICreateStateMachineOptions<TS, TE>['guards']> = options.guards ?? {};
  const $state = signal<TS>(initial);

  return {
    $state: $state.asReadonly(),
    is: (state) => $state() === state,
    can: (event) => {
      const to = transitions[$state()]?.[event];
      if (to === undefined) return false;
      const guard = guards[`${$state()}.${event}`];
      return guard ? guard() : true;
    },
    send: (event) => {
      const from = $state();
      const to = transitions[from]?.[event];
      if (to === undefined) {
        warnDev(`createStateMachine: transición inválida '${from}.${event}' ignorada.`);
        return false;
      }
      const guard = guards[`${from}.${event}`];
      if (guard && !guard()) {
        warnDev(`createStateMachine: guard bloqueó la transición '${from}.${event}'.`);
        return false;
      }
      $state.set(to);
      return true;
    },
  };
}

/** En dev la config se valida al crearla: errores de tipeo rompen en el arranque, no en runtime. */
function assertValidConfig<TS extends string, TE extends string>(
  options: ICreateStateMachineOptions<TS, TE>,
): void {
  if (!isDevMode()) return;
  const { initial, states, transitions, guards } = options;

  if (states.length === 0) throw new Error('createStateMachine: `states` no puede estar vacío.');
  if (new Set(states).size !== states.length) {
    throw new Error('createStateMachine: hay estados duplicados en `states`.');
  }
  if (!states.includes(initial)) {
    throw new Error(`createStateMachine: el estado inicial '${initial}' no está en \`states\`.`);
  }
  const stateSet = new Set(states);
  for (const from of states) {
    for (const to of Object.values(transitions[from] ?? {}) as TS[]) {
      if (!stateSet.has(to)) {
        throw new Error(`createStateMachine: el destino '${to}' (desde '${from}') no está en \`states\`.`);
      }
    }
  }
  for (const key of Object.keys(guards ?? {})) {
    const [from, event] = key.split('.');
    if (transitions[from as TS]?.[event as TE] === undefined) {
      throw new Error(`createStateMachine: la guard '${key}' no corresponde a ninguna transición.`);
    }
  }
}

function warnDev(message: string): void {
  if (isDevMode()) console.warn(message);
}
