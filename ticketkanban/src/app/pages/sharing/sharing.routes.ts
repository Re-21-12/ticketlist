import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const SHARING_ROUTES: Routes = [
  {
    path: '',
    title: 'Compartir mis tickets',
    // Todo titular puede compartir lo suyo: la regla `create Relationship` la da el backend a cualquier sesión.
    canActivate: [canGuard('create', 'Relationship')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./sharing').then((m) => m.Sharing),
  },
];
