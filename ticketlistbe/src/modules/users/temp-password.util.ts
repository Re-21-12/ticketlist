import { randomInt } from 'node:crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '#?!@$%*+-';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

/** Vigencia de una contraseña temporal entregada por la administración (72 h). */
export const TEMP_PASSWORD_TTL_MS = 72 * 60 * 60 * 1000;

const pick = (chars: string): string => chars[randomInt(chars.length)] as string;

/**
 * Contraseña temporal de 16 caracteres con CSPRNG que cumple `StrongPasswordSchema` (mayúscula, minúscula, dígito y
 * símbolo) y sin caracteres ambiguos (0/O, 1/l/I) para poder dictarla.
 */
export function generateTempPassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < 16) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
