import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * El front (ticketkanban) tiene un ESPEJO de este catálogo para validar el formulario con los
 * mismos mensajes. Hasta extraer `@ticketit/contracts`, este test falla si divergen. Se salta si
 * ticketkanban no está clonado al lado (p. ej. en el CI de solo backend).
 */
const backPath = resolve(process.cwd(), 'src/common/codes/validation-errors.ts');
const frontPath = resolve(process.cwd(), '../ticketkanban/src/app/core/validation/validation-errors.ts');

/** Desde la primera declaración: los encabezados de comentario difieren a propósito. */
const body = (path: string) => {
  const source = readFileSync(path, 'utf8');
  return source.slice(source.indexOf('export interface IValidationMessage')).replace(/\r\n/g, '\n');
};

describe.skipIf(!existsSync(frontPath))('VALIDATION_ERRORS espejo front ↔ back', () => {
  it('ticketkanban/core/validation/validation-errors.ts es idéntico (desde las declaraciones)', () => {
    expect(body(frontPath)).toBe(body(backPath));
  });
});
