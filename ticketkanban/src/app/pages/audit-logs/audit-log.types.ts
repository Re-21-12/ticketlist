import type { z } from 'zod';
import type { AUDIT_ACTIONS, AUDIT_OUTCOMES, AuditLogSchema, AuditLogViewSchema } from './audit-log.schema';

export type TAuditLog = z.output<typeof AuditLogSchema>;
export type TAuditLogView = z.output<typeof AuditLogViewSchema>;
export type TAuditAction = (typeof AUDIT_ACTIONS)[number];
export type TAuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** Filtros de la pantalla; vacío = sin filtrar. */
export interface IAuditFilters extends Record<string, string> {
  action: string;
  outcome: string;
}
