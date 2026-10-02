import { Service, signal } from '@angular/core';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { AuditLogSchema } from './audit-log.schema';
import type { IAuditFilters, TAuditLog } from './audit-log.types';

/** Acceso HTTP de `/api/audit-logs`: SOLO lectura (el registro es inmutable, no hay alta ni edición). */
@Service()
export class AuditLogsService extends BaseApiAbstract<TAuditLog, never, never, IAuditFilters> {
  protected readonly endpoint = '/api/audit-logs';
  protected readonly $uuid = signal<string | undefined>(undefined);

  protected override parseItem(raw: unknown): TAuditLog {
    return AuditLogSchema.parse(raw);
  }

  /** Quita los filtros vacíos: el backend rechaza `?action=` (no es un valor del enum). */
  filterBy(filters: IAuditFilters): void {
    const active = Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as IAuditFilters;
    this.setFilters(Object.keys(active).length ? active : undefined);
  }
}
