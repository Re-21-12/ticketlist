import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { signInTree } from '../session/auth.guard';
import { SessionStore } from '../session/session.store';
import { AbilityServiceSignal } from '@casl/angular';
import type { AppAbility, TAbilityAction, TSubjects } from './casl.types';

/**
 * Guard de autorización (port de `canGuard` de wallet-api): bloquea la ruta si la sesión no tiene
 * la habilidad CASL y redirige a `redirectTo`. Esconder el link no alcanza — la URL directa
 * también debe estar protegida (y el backend vuelve a validar con su propio CaslGuard).
 *
 * Uso: `canActivate: [canGuard('create', 'Ticket')], runGuardsAndResolvers: 'always'` (sin
 * `'always'`, al cambiar la sesión y re-navegar a la misma URL el guard no se re-evalúa).
 * Destino por defecto `/access`: una ruta SIN guard (redirigir a otra ruta protegida puede entrar en bucle).
 */
export function canGuard(
  action: TAbilityAction,
  subject: TSubjects,
  redirectTo = '/access',
): CanActivateFn {
  return (_route, state) => {
    const router = inject(Router);
    // Sin SESIÓN → a iniciar sesión (y de vuelta aquí al terminar). Con sesión pero sin permiso → `redirectTo`.
    if (!inject(SessionStore).$isAuthenticated()) return signInTree(router, state.url);
    const abilityService = inject<AbilityServiceSignal<AppAbility>>(AbilityServiceSignal);
    return abilityService.can(action, subject) || router.createUrlTree([redirectTo]);
  };
}
