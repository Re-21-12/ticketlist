import type { IAuditLog, TAuditAction, TAuditOutcome } from './audit-log.entity.js';

export const AUDIT_STORE = Symbol('AUDIT_STORE');

export interface IAuditFilters {
  search?: string;
  action?: TAuditAction;
  outcome?: TAuditOutcome;
  subject?: string;
  actorUuid?: string;
  from?: Date;
  to?: Date;
  page: number;
  take: number;
}

/**
 * Almacén del registro de auditoría. APPEND-ONLY por contrato: no hay update ni delete. Dos
 * adaptadores intercambiables (los valida el mismo contrato en `audit-log.store.contract.spec.ts`):
 * memoria (desarrollo/tests) y Postgres (`DATABASE_URL`).
 */
export interface IAuditLogStore {
  append(entry: IAuditLog): Promise<void>;
  /** Más nuevos primero. */
  findAll(filters: IAuditFilters): Promise<[IAuditLog[], number]>;
  findByUuid(uuid: string): Promise<IAuditLog | null>;
  close(): Promise<void>;
}
