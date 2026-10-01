import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    // Lazy también el shell: sidebar/drawer no entran al bundle inicial.
    loadComponent: () => import('./layouts/layout/layout').then((m) => m.Layout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tickets' },
      {
        path: 'tickets',
        loadChildren: () => import('./pages/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES),
      },
      {
        path: 'profile',
        loadChildren: () => import('./pages/profile/profile.routes').then((m) => m.PROFILE_ROUTES),
      },
      {
        path: 'style-guide',
        loadChildren: () =>
          import('./pages/style-guide/style-guide.routes').then((m) => m.STYLE_GUIDE_ROUTES),
      },
      {
        path: 'access',
        loadChildren: () => import('./pages/access/access.routes').then((m) => m.ACCESS_ROUTES),
      },
      {
        path: 'appearance',
        loadChildren: () =>
          import('./pages/appearance/appearance.routes').then((m) => m.APPEARANCE_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
