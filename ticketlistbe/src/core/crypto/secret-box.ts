import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Cifrado de secretos EN REPOSO (hoy: el secreto TOTP): AES-256-GCM con la clave derivada (sha256) de
 * `TOTP_ENCRYPTION_KEY`. Formato `v1.<iv>.<tag>.<texto>` en base64url. GCM autentica: un valor
 * alterado (o abierto con otra clave) NO se descifra, falla.
 */
const VERSION = 'v1';

const keyOf = (secret: string): Buffer => createHash('sha256').update(secret).digest();

export function sealSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}

export function openSecret(sealed: string, secret: string): string {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !body) throw new Error('Secreto cifrado con formato desconocido');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
}
