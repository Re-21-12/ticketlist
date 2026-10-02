import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const ROLE_PERMISSIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Permisos por rol',
    canActivate: [canGuard('read', 'RolePermission')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./role-permissions').then((m) => m.RolePermissions),
  },
];
