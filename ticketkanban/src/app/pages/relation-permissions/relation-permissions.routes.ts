import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const RELATION_PERMISSIONS_ROUTES: Routes = [
  {
    path: '',
    title: 'Relaciones',
    // `manage`: solo quien administra Relationship (ADMIN); un titular común usa «Compartir mis tickets».
    canActivate: [canGuard('manage', 'Relationship')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./relation-permissions').then((m) => m.RelationPermissions),
  },
];
