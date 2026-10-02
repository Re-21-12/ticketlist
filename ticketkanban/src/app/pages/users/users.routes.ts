import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    title: 'Usuarios',
    canActivate: [canGuard('read', 'User')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./users').then((m) => m.Users),
  },
];
