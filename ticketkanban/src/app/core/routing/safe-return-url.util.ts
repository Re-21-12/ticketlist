/** Destino por defecto tras iniciar sesión. */
export const DEFAULT_RETURN_URL = '/tickets';

/**
 * `returnUrl` viene de la URL (alguien puede enlazar `/sign-in?returnUrl=https://sitio-malo.com`): solo se
 * acepta una ruta INTERNA de la app. Rechaza `//host` (relativa al protocolo), `/\host`, esquemas
 * (`javascript:`, `https:`), saltos de línea y las pantallas de acceso (evita el bucle sign-in → sign-in).
 */
export function safeReturnUrl(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith('/')) return DEFAULT_RETURN_URL;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return DEFAULT_RETURN_URL;
  if (hasControlOrBackslash(candidate)) return DEFAULT_RETURN_URL;
  const path = candidate.split(/[?#]/)[0];
  if (AUTH_PATHS.has(path)) return DEFAULT_RETURN_URL;
  return candidate;
}

/** Saltos de línea (inyección de cabeceras), caracteres de control y la barra invertida (algunos navegadores la tratan como `/`). */
function hasControlOrBackslash(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

const AUTH_PATHS: ReadonlySet<string> = new Set([
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/access',
]);
