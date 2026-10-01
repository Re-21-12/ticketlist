import { FieldType, type IFieldConfig, type TInputFilter } from '../field-config.interface';

/**
 * Filtros de teclado y pegado de `<input>` (port de `on-input-validator.ts` y
 * `on-paste-validator.ts` de wallet-api). Impiden que un carácter inválido ENTRE al campo; no
 * reemplazan a Zod, que sigue validando el valor final.
 *
 * Diferencias con wallet-api:
 *  - Un `TEXT` NO filtra a letras por defecto (allá sí, y no sirve para títulos como «TCK-12»):
 *    el filtro es opt-in con `IFieldConfig.inputFilter`.
 *  - El pegado de correos acepta cualquier TLD (allá exigía `.com`).
 *  - Sin `console.log` en producción.
 */

type TInput = HTMLInputElement | HTMLTextAreaElement;

/** ¿Escribir/pegar `chunk` superaría el `maxlength` del control (descontando la selección)? */
function exceedsMaxLength(input: TInput, chunk: string): boolean {
  const max = input.maxLength;
  if (!(max > 0)) return false;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  return input.value.length - (end - start) + chunk.length > max;
}

/**
 * ¿Un '.' dejaría el valor SIN ningún dígito antes? `Number('.')` es NaN aunque la regex de los
 * decimales lo permita como carácter, y Signal Forms lo reportaría como error de parseo.
 */
function startsWithDot(input: TInput, key: string): boolean {
  if (key !== '.') return false;
  const start = input.selectionStart ?? input.value.length;
  return !/\d/.test(input.value.slice(0, start));
}

const PATTERNS = {
  integer: /^\d+$/,
  decimal: /^\d+(\.\d+)?$/,
  money: /^\d+(\.\d{1,2})?$/,
  letters: /^[\p{L}\s]+$/u,
  email: /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/,
} satisfies Record<TInputFilter, RegExp>;

const KEY_ALLOWED = {
  integer: /^\d$/,
  letters: /^[\p{L}\s]$/u,
  email: /^[A-Za-z0-9._+\-@]$/,
} as const;

/** ¿Esta tecla es un carácter imprimible? Las de control (Enter, flechas, Ctrl+…) no se filtran. */
function isPrintable(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
}

/** Bloquea en `keypress` el carácter que no cabe en el filtro del campo. */
export function filterKeypress(filter: TInputFilter, event: KeyboardEvent): void {
  if (!isPrintable(event)) return;
  const input = event.target as TInput;
  const key = event.key;

  let allowed: boolean;
  switch (filter) {
    case 'integer':
    case 'letters':
      allowed = KEY_ALLOWED[filter].test(key);
      break;
    case 'email':
      // Un solo '@' en todo el valor.
      allowed = KEY_ALLOWED.email.test(key) && !(key === '@' && input.value.includes('@'));
      break;
    case 'decimal':
      allowed = /^\d*\.?\d*$/.test(input.value + key) && !startsWithDot(input, key);
      break;
    case 'money': {
      const value = input.value;
      const [, decimals = ''] = value.split('.');
      const afterDot = value.includes('.') && (input.selectionStart ?? value.length) > value.indexOf('.');
      allowed =
        /^[0-9.]$/.test(key) &&
        !(key === '.' && value.includes('.')) &&
        !startsWithDot(input, key) &&
        // Máximo 2 decimales.
        !(afterDot && decimals.length >= 2);
      break;
    }
  }
  if (!allowed || exceedsMaxLength(input, key)) event.preventDefault();
}

/** Rechaza en `paste` un texto que no cumple el filtro del campo. */
export function filterPaste(filter: TInputFilter, event: ClipboardEvent): void {
  const input = event.target as TInput;
  const data = event.clipboardData?.getData('text') ?? '';
  if (exceedsMaxLength(input, data) || !PATTERNS[filter].test(data)) event.preventDefault();
}

/** Filtro de un campo: el declarado, o el que implica su tipo numérico. */
export function resolveInputFilter(field: Pick<IFieldConfig, 'type' | 'inputFilter'>): TInputFilter | null {
  if (field.inputFilter) return field.inputFilter;
  switch (field.type) {
    case FieldType.TEXT_NUMBER:
    case FieldType.INTEGER:
      return 'integer';
    case FieldType.DECIMAL:
      return 'decimal';
    case FieldType.CURRENCY:
      return 'money';
    case FieldType.EMAIL:
      return 'email';
    default:
      return null;
  }
}
