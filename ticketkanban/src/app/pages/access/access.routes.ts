import type { Routes } from '@angular/router';

/** SIN guard a propósito: es el destino de `canGuard` cuando rechaza (evita bucles de redirección). */
export const ACCESS_ROUTES: Routes = [
  {
    path: '',
    title: 'Acceso',
    loadComponent: () => import('./access').then((m) => m.Access),
  },
];
