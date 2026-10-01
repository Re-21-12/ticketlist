import { FieldType, type TInputFilter } from '../field-config.interface';
import { filterKeypress, filterPaste, resolveInputFilter } from './input-filters.util';

interface IFakeInputOptions {
  max?: number;
  start?: number;
  end?: number;
}

/** `<input>` mínimo con la API que usan los filtros (valor, selección, maxLength). */
function fakeInput(value: string, options: IFakeInputOptions = {}): HTMLInputElement {
  return {
    value,
    maxLength: options.max ?? -1,
    selectionStart: options.start ?? value.length,
    selectionEnd: options.end ?? value.length,
  } as HTMLInputElement;
}

/** ¿El filtro DEJA escribir esa tecla? */
function allowsKey(
  filter: TInputFilter,
  input: HTMLInputElement,
  key: string,
  modifiers: Partial<KeyboardEvent> = {},
): boolean {
  let prevented = false;
  const event = {
    key,
    target: input,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...modifiers,
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as KeyboardEvent;
  filterKeypress(filter, event);
  return !prevented;
}

function allowsPaste(filter: TInputFilter, input: HTMLInputElement, data: string): boolean {
  let prevented = false;
  const event = {
    target: input,
    clipboardData: { getData: () => data },
    preventDefault: () => {
      prevented = true;
    },
  } as unknown as ClipboardEvent;
  filterPaste(filter, event);
  return !prevented;
}

describe('filterKeypress', () => {
  it('integer: solo dígitos', () => {
    expect(allowsKey('integer', fakeInput(''), '7')).toBe(true);
    expect(allowsKey('integer', fakeInput(''), 'a')).toBe(false);
    expect(allowsKey('integer', fakeInput(''), '.')).toBe(false);
  });

  it('letters: letras (con tildes) y espacios', () => {
    expect(allowsKey('letters', fakeInput(''), 'ñ')).toBe(true);
    expect(allowsKey('letters', fakeInput(''), ' ')).toBe(true);
    expect(allowsKey('letters', fakeInput(''), '3')).toBe(false);
  });

  it('decimal: un solo punto y nunca como primer carácter', () => {
    expect(allowsKey('decimal', fakeInput('1'), '.')).toBe(true);
    expect(allowsKey('decimal', fakeInput('1.5'), '.')).toBe(false);
    expect(allowsKey('decimal', fakeInput(''), '.')).toBe(false);
  });

  it('money: máximo 2 decimales', () => {
    expect(allowsKey('money', fakeInput('10.5'), '5')).toBe(true);
    expect(allowsKey('money', fakeInput('10.55'), '5')).toBe(false);
    // Con el cursor ANTES del punto sí se puede seguir escribiendo enteros.
    expect(allowsKey('money', fakeInput('10.55', { start: 1, end: 1 }), '5')).toBe(true);
  });

  it('email: un solo @ y solo caracteres de correo', () => {
    expect(allowsKey('email', fakeInput('ana'), '@')).toBe(true);
    expect(allowsKey('email', fakeInput('ana@x'), '@')).toBe(false);
    expect(allowsKey('email', fakeInput('ana'), ' ')).toBe(false);
  });

  it('respeta el maxlength del control (el contador «n / máx» controla la escritura)', () => {
    expect(allowsKey('letters', fakeInput('abc', { max: 3 }), 'd')).toBe(false);
    // Reemplazando una selección sí hay lugar.
    expect(allowsKey('letters', fakeInput('abc', { max: 3, start: 0, end: 3 }), 'd')).toBe(true);
  });

  it('no filtra teclas de control ni atajos (Ctrl+C, Enter, flechas)', () => {
    expect(allowsKey('integer', fakeInput(''), 'Enter')).toBe(true);
    expect(allowsKey('integer', fakeInput(''), 'c', { ctrlKey: true })).toBe(true);
  });
});

describe('filterPaste', () => {
  it('rechaza un texto que no cumple el filtro', () => {
    expect(allowsPaste('integer', fakeInput(''), '123')).toBe(true);
    expect(allowsPaste('integer', fakeInput(''), '12a')).toBe(false);
  });

  it('rechaza un texto que no cabe en el maxlength', () => {
    expect(allowsPaste('integer', fakeInput('12', { max: 4 }), '345')).toBe(false);
    expect(allowsPaste('integer', fakeInput('12', { max: 4 }), '34')).toBe(true);
  });

  it('el correo acepta cualquier TLD (wallet-api exigía «.com»)', () => {
    expect(allowsPaste('email', fakeInput(''), 'ana@empresa.dev')).toBe(true);
    expect(allowsPaste('email', fakeInput(''), 'ana@empresa')).toBe(false);
  });
});

describe('resolveInputFilter', () => {
  it('un TEXT NO filtra por defecto (wallet-api lo limitaba a letras)', () => {
    expect(resolveInputFilter({ type: FieldType.TEXT })).toBeNull();
  });

  it('los numéricos se filtran solos; el filtro declarado gana', () => {
    expect(resolveInputFilter({ type: FieldType.INTEGER })).toBe('integer');
    expect(resolveInputFilter({ type: FieldType.CURRENCY })).toBe('money');
    expect(resolveInputFilter({ type: FieldType.TEXT, inputFilter: 'letters' })).toBe('letters');
  });
});
