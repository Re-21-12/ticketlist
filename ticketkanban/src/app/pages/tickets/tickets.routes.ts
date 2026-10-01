import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

// Toda ruta con `canGuard` lleva `runGuardsAndResolvers: 'always'`: al cambiar de rol o cerrar
// sesión el layout re-navega a la misma URL, y sin esto el guard NO vuelve a evaluarse.
export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    title: 'Tablero',
    canActivate: [canGuard('read', 'Ticket')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./tickets').then((m) => m.Tickets),
  },
  {
    path: 'list',
    title: 'Listado',
    canActivate: [canGuard('read', 'Ticket')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./ticket-list/ticket-list').then((m) => m.TicketList),
  },
  {
    path: 'new',
    title: 'Nuevo ticket',
    canActivate: [canGuard('create', 'Ticket', '/tickets')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./ticket-new/ticket-new').then((m) => m.TicketNew),
  },
];
