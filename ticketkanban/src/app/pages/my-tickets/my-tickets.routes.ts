import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

// `?ticket=<uuid>` abre el detalle de ese ticket (lo usan los avisos de la campana).
export const MY_TICKETS_ROUTES: Routes = [
  {
    path: '',
    title: 'Mis tickets',
    canActivate: [canGuard('read', 'Ticket')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./my-tickets').then((m) => m.MyTickets),
  },
];
