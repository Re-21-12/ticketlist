import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Paso de 30 s y 6 dígitos: lo que usan Google Authenticator, Authy y 1Password por defecto. */
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Secreto aleatorio de 160 bits en base32 (lo que se escanea o se escribe en la app autenticadora). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('base32 inválido');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Paso de tiempo (contador) al instante `atMs`. */
export const totpStep = (atMs: number): number => Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);

/** Código TOTP del contador dado (HOTP, RFC 4226, truncado dinámico). */
export function totpCode(secret: string, step: number, digits = TOTP_DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = (mac[mac.length - 1] as number) & 0x0f;
  const binary =
    (((mac[offset] as number) & 0x7f) << 24) |
    (((mac[offset + 1] as number) & 0xff) << 16) |
    (((mac[offset + 2] as number) & 0xff) << 8) |
    ((mac[offset + 3] as number) & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Verifica un código con tolerancia de ±1 paso (relojes desfasados). Devuelve el PASO que coincidió o
 * `null`: quien llama guarda ese paso y rechaza los menores o iguales, así un código no se reutiliza.
 */
export function verifyTotp(secret: string, code: string, atMs: number, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(atMs);
  for (let step = current - window; step <= current + window; step++) {
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

/** URL `otpauth://` que escanean las apps autenticadoras (se dibuja como QR en el front). */
export function otpauthUrl(secret: string, account: string, issuer = 'Ticketit'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
