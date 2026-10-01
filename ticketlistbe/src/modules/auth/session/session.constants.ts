/** Nombre de la cookie de sesión: un id OPACO, nunca datos (el estado vive en el store). */
export const SESSION_COOKIE = 'sid';
/** Cookie de CSRF double-submit: legible por JS a propósito (Angular la copia al header). */
export const XSRF_COOKIE = 'XSRF-TOKEN';
export const XSRF_HEADER = 'x-xsrf-token';
/** Inactividad: la cookie expira a los 30 min sin requests (`rolling` la renueva en cada una). */
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60_000;
/** Tope ABSOLUTO desde el login, aunque haya actividad (lo valida SessionAuthGuard). */
export const SESSION_ABSOLUTE_MAX_MS = 7 * 24 * 60 * 60_000;
/** La cookie solo viaja a la API (RFC 6265 §5.1.4). */
export const COOKIE_PATH = '/api';
