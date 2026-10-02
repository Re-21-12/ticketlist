import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const CATALOGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Catálogos',
    canActivate: [canGuard('read', 'Catalog')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./catalogs').then((m) => m.Catalogs),
  },
];
