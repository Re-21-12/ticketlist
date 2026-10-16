import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { DEFAULT_RETURN_URL } from '../routing/safe-return-url.util';
import { signInTree } from './auth.guard';
import { SessionStore } from './session.store';

/**
 * «Cambiar contraseña» obligatorio: SOLO para quien entró con una contraseña temporal. Sin sesión va a `/sign-in`; con
 * sesión y nada pendiente no tiene sentido verla y manda al tablero.
 */
export const passwordPendingGuard: CanActivateFn = (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  if (!store.$isAuthenticated()) return signInTree(router, state.url);
  return store.$mustChangePassword() || router.parseUrl(DEFAULT_RETURN_URL);
};
