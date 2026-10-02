import type { Routes } from '@angular/router';
import { canGuard } from '../../core/casl/ability.guard';

export const AUDIT_LOGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Auditoría',
    canActivate: [canGuard('read', 'AuditLog')],
    runGuardsAndResolvers: 'always',
    loadComponent: () => import('./audit-logs').then((m) => m.AuditLogs),
  },
];
