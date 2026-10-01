import type { Routes } from '@angular/router';

export const APPEARANCE_ROUTES: Routes = [
  {
    path: '',
    title: 'Apariencia',
    loadComponent: () => import('./appearance').then((m) => m.Appearance),
  },
];
