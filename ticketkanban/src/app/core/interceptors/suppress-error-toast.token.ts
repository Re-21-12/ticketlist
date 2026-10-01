import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Marca un request cuyo error maneja el caller: `errorInterceptor` no muestra toast. */
export const SUPPRESS_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

export function suppressErrorToast(): HttpContext {
  return new HttpContext().set(SUPPRESS_ERROR_TOAST, true);
}
