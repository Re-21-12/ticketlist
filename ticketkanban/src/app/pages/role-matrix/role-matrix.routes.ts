import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const ROLE_MATRIX_ROUTES: Routes = [
  {
    path: '',
    title: 'Matriz de roles',
    canActivate: [canGuard('read', 'RolePermission')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./role-matrix').then((m) => m.RoleMatrix),
  },
];
