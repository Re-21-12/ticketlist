import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

// Toda ruta con `canGuard` lleva `runGuardsAndResolvers: 'always'` (ver tickets.routes.ts).
export const METRICS_ROUTES: Routes = [
  {
    path: '',
    title: 'Métricas del equipo',
    canActivate: [canGuard('read', 'Metric')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./metrics').then((m) => m.Metrics),
  },
];

export const MY_METRICS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis métricas',
    canActivate: [canGuard('read', 'MyMetric')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./my-metrics/my-metrics').then((m) => m.MyMetrics),
  },
];
