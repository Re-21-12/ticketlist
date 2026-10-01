import { createStateMachine } from './create-state-machine';
import type { ICreateStateMachineOptions, IStateMachine } from './create-state-machine.interface';

type TUiState = 'idle' | 'running' | 'done' | 'error';
type TUiEvent = 'START' | 'FINISH' | 'FAIL' | 'RESET';

const makeMachine = (guards?: ICreateStateMachineOptions<TUiState, TUiEvent>['guards']) =>
  createStateMachine<TUiState, TUiEvent>({
    initial: 'idle',
    states: ['idle', 'running', 'done', 'error'],
    transitions: {
      idle: { START: 'running' },
      running: { FINISH: 'done', FAIL: 'error' },
      done: { RESET: 'idle' },
      error: { RESET: 'idle' },
    },
    guards,
  });

/** Configs inválidas a propósito: el compilador las rechazaría, se prueba el error de runtime. */
const buildInvalid = (config: unknown): IStateMachine<TUiState, TUiEvent> =>
  createStateMachine<TUiState, TUiEvent>(config as ICreateStateMachineOptions<TUiState, TUiEvent>);

describe('createStateMachine', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => undefined));

  it('arranca en el estado inicial y transiciona con eventos válidos', () => {
    const machine = makeMachine();
    expect(machine.$state()).toBe('idle');
    expect(machine.send('START')).toBe(true);
    expect(machine.is('running')).toBe(true);
  });

  it('ignora un evento no declarado desde el estado actual (false, sin cambiar)', () => {
    const machine = makeMachine();
    expect(machine.send('FINISH')).toBe(false);
    expect(machine.$state()).toBe('idle');
  });

  it('can() refleja las transiciones válidas del estado actual', () => {
    const machine = makeMachine();
    expect(machine.can('START')).toBe(true);
    expect(machine.can('RESET')).toBe(false);
  });

  it('una guard en false bloquea la transición', () => {
    let allowed = false;
    const machine = makeMachine({ 'idle.START': () => allowed });
    expect(machine.send('START')).toBe(false);
    allowed = true;
    expect(machine.send('START')).toBe(true);
  });

  it('valida la config en dev: destino inexistente', () => {
    expect(() =>
      buildInvalid({ initial: 'idle', states: ['idle'], transitions: { idle: { START: 'nope' } } }),
    ).toThrow(/destino 'nope'/);
  });

  it('valida la config en dev: estado inicial fuera de states', () => {
    expect(() => buildInvalid({ initial: 'x', states: ['idle'], transitions: { idle: {} } })).toThrow(
      /estado inicial 'x'/,
    );
  });
});
