import { createHmac, randomInt } from 'node:crypto';

/** Sin 0/O, 1/I/L: se dictan y se copian a mano sin confundirse. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const RECOVERY_CODE_COUNT = 10;

/** `XXXX-XXXX` (8 caracteres, ~40 bits) con CSPRNG. */
export function generateRecoveryCode(): string {
  const pick = (): string => ALPHABET[randomInt(ALPHABET.length)] as string;
  const part = (): string => Array.from({ length: 4 }, pick).join('');
  return `${part()}-${part()}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(generateRecoveryCode());
  return [...codes];
}

/** Quita espacios y guion y pasa a mayúsculas: «abcd efgh» = «ABCD-EFGH». */
export const normalizeRecoveryCode = (code: string): string => code.replace(/[\s-]/g, '').toUpperCase();

/** HMAC con la clave del servidor: en la base solo quedan huellas, nunca los códigos. */
export const hashRecoveryCode = (code: string, key: string): string => createHmac('sha256', key).update(normalizeRecoveryCode(code)).digest('hex');
