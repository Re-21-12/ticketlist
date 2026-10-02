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
  return inject(SessionStore).$isAuthenticated() || signInTree(router, state.url);
};

/** `/sign-in?returnUrl=…` — el destino se valida al volver (ver `safeReturnUrl`). */
export function signInTree(router: Router, returnUrl: string) {
  return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl } });
}
