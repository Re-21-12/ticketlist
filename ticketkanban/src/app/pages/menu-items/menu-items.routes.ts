import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const MENU_ITEMS_ROUTES: Routes = [
  {
    path: '',
    title: 'Menú',
    canActivate: [canGuard('read', 'MenuItem')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./menu-items').then((m) => m.MenuItems),
  },
];
