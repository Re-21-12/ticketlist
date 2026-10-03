import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const JOBS_ROUTES: Routes = [
  {
    path: '',
    title: 'Tareas programadas',
    canActivate: [canGuard('read', 'ScheduledJob')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./jobs').then((m) => m.Jobs),
  },
];
