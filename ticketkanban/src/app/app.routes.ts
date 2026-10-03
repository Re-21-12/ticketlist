import { Routes } from '@angular/router';

export const routes: Routes = [
  // Primero: con la URL vacía el layout de acceso (path '') «coincidiría» sin ningún hijo y se pintaría vacío.
  { path: '', pathMatch: 'full', redirectTo: 'tickets' },
  {
    // Acceso: tarjeta centrada SIN menú. Va ANTES del shell. Si un destino de acceso no existiera, el
    // comodín `**` + un guard que redirige a él formarían un bucle infinito (pantalla en negro y CPU
    // al 100 %): por eso `auth.routes.spec.ts` verifica que cada destino al que redirige un guard exista.
    path: '',
    loadComponent: () => import('./layouts/auth-layout/auth-layout').then((m) => m.AuthLayout),
    loadChildren: () => import('./pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    // Lazy también el shell: sidebar/drawer no entran al bundle inicial.
    loadComponent: () => import('./layouts/layout/layout').then((m) => m.Layout),
    children: [
      {
        path: 'my-tickets',
        loadChildren: () => import('./pages/my-tickets/my-tickets.routes').then((m) => m.MY_TICKETS_ROUTES),
      },
      {
        path: 'tickets',
        loadChildren: () => import('./pages/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES),
      },
      {
        path: 'metrics',
        loadChildren: () => import('./pages/metrics/metrics.routes').then((m) => m.METRICS_ROUTES),
      },
      {
        path: 'my-metrics',
        loadChildren: () => import('./pages/metrics/metrics.routes').then((m) => m.MY_METRICS_ROUTES),
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
      // Administración: cada ruta lleva su `canGuard` (el menú solo esconde el enlace, la URL directa también se protege).
      {
        path: 'sharing',
        loadChildren: () => import('./pages/sharing/sharing.routes').then((m) => m.SHARING_ROUTES),
      },
      {
        path: 'relation-permissions',
        loadChildren: () =>
          import('./pages/relation-permissions/relation-permissions.routes').then((m) => m.RELATION_PERMISSIONS_ROUTES),
      },
      {
        path: 'role-matrix',
        loadChildren: () => import('./pages/role-matrix/role-matrix.routes').then((m) => m.ROLE_MATRIX_ROUTES),
      },
      {
        path: 'role-permissions',
        loadChildren: () =>
          import('./pages/role-permissions/role-permissions.routes').then((m) => m.ROLE_PERMISSIONS_ROUTES),
      },
      {
        path: 'users',
        loadChildren: () => import('./pages/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'menu-items',
        loadChildren: () => import('./pages/menu-items/menu-items.routes').then((m) => m.MENU_ITEMS_ROUTES),
      },
      {
        path: 'catalogs',
        loadChildren: () => import('./pages/catalogs/catalogs.routes').then((m) => m.CATALOGS_ROUTES),
      },
      {
        path: 'jobs',
        loadChildren: () => import('./pages/jobs/jobs.routes').then((m) => m.JOBS_ROUTES),
      },
      {
        path: 'audit-logs',
        loadChildren: () => import('./pages/audit-logs/audit-logs.routes').then((m) => m.AUDIT_LOGS_ROUTES),
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
