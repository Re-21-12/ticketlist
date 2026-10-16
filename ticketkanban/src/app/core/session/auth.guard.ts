import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SessionStore } from './session.store';

/**
 * Pantallas que solo necesitan SESIÓN (no una habilidad CASL concreta), como «Mi perfil». Sin sesión
 * manda a `/sign-in` recordando a dónde iba (`returnUrl`). Usar con `runGuardsAndResolvers: 'always'`:
 * al cerrar sesión el layout re-navega a la misma URL y el guard debe volver a evaluarse.
 */
export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const store = inject(SessionStore);
  if (!store.$isAuthenticated()) return signInTree(router, state.url);
  // Con una contraseña temporal pendiente solo existe «Cambiar contraseña».
  return store.$mustChangePassword() ? router.createUrlTree([CHANGE_PASSWORD_URL]) : true;
};

/** Pantalla obligatoria tras entrar con una contraseña temporal (existe SIEMPRE en el router: ningún guard puede formar un bucle). */
export const CHANGE_PASSWORD_URL = '/change-password';

/** `/sign-in?returnUrl=…` — el destino se valida al volver (ver `safeReturnUrl`). */
export function signInTree(router: Router, returnUrl: string) {
  return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl } });
}
