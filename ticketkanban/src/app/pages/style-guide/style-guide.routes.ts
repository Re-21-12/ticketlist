import type { Routes } from '@angular/router';

/** Sin guard: la guía no expone datos y sirve también sin sesión (enlace desde /access). */
export const STYLE_GUIDE_ROUTES: Routes = [
  {
    path: '',
    title: 'Guía de estilos',
    loadComponent: () => import('./style-guide').then((m) => m.StyleGuide),
  },
];
