import type { Routes } from '@angular/router';
import { authenticatedGuard } from '../../core/session/auth.guard';

export const PROFILE_ROUTES: Routes = [
  {
    path: '',
    title: 'Mi perfil',
    canActivate: [authenticatedGuard],
    // 'always': al cerrar sesión el layout re-navega a la misma URL y el guard vuelve a evaluarse.
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./profile').then((m) => m.Profile),
  },
];
