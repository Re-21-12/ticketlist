import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DEFAULT_RETURN_URL, safeReturnUrl } from '../routing/safe-return-url.util';
import { SessionStore } from './session.store';

/**
 * Pantallas SOLO para quien no tiene sesión (iniciar sesión, crear cuenta). Con sesión abierta no tiene
 * sentido verlas: manda al destino que traía (`returnUrl`, validado) o al tablero.
 */
export const guestOnlyGuard: CanActivateFn = (route) => {
  if (!inject(SessionStore).$isAuthenticated()) return true;
  const requested = route.queryParamMap.get('returnUrl');
  return inject(Router).parseUrl(requested ? safeReturnUrl(requested) : DEFAULT_RETURN_URL);
};
