import { createHash } from 'node:crypto';

/**
 * ETag FUERTE y OPACO (RFC 9110 §8.8.3): `"<sha256 base64url de la representación JSON>"`.
 * Se calcula sobre la MISMA representación que recibe el cliente, así el ETag del GET sirve
 * tal cual como `If-Match` del PATCH/DELETE. (wallet-api usa uuid+updatedAt; aquí el body
 * completo porque también cubre listados y respuestas del BFF que no tienen `updatedAt`.)
 */
export function buildEtag(body: unknown): string {
  return `"${createHash('sha256').update(JSON.stringify(body) ?? '').digest('base64url')}"`;
}

/**
 * ¿`header` (If-Match / If-None-Match) coincide con `etag`? Acepta lista separada por comas,
 * `*` y el prefijo débil `W/` (comparación débil de RFC 9110 §8.8.3.2 para If-None-Match).
 */
export function etagMatches(header: string | null | undefined, etag: string): boolean {
  if (!header) return false;
  const normalize = (value: string) => value.trim().replace(/^W\//, '');
  return header
    .split(',')
    .map(normalize)
    .some((candidate) => candidate === '*' || candidate === normalize(etag));
}
