import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SessionStore } from './session.store';

/**
 * Pantallas que solo necesitan SESIÓN (no una habilidad CASL concreta), como «Mi perfil». Sin sesión
 * redirige a `/access` (ruta sin guard). Usar con `runGuardsAndResolvers: 'always'`: al cerrar sesión
 * el layout re-navega a la misma URL y el guard debe volver a evaluarse.
 */
export const authenticatedGuard: CanActivateFn = () =>
  inject(SessionStore).$isAuthenticated() || inject(Router).createUrlTree(['/access']);
