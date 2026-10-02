import type { IAuditLog } from './audit-log.entity.js';
import type { IAuditFilters, IAuditLogStore } from './audit-log.store.js';

/** Tope en memoria: al llegar se descartan los más antiguos (con Postgres no hay tope). */
export const AUDIT_MAX_ENTRIES = 10_000;

/** Registro en memoria (desarrollo y tests). Se pierde al reiniciar: para persistir, `DATABASE_URL`. */
export class MemoryAuditLogStore implements IAuditLogStore {
  private entries: IAuditLog[] = [];

  append(entry: IAuditLog): Promise<void> {
    this.entries = [entry, ...this.entries].slice(0, AUDIT_MAX_ENTRIES);
    return Promise.resolve();
  }

  findAll(filters: IAuditFilters): Promise<[IAuditLog[], number]> {
    const term = filters.search?.trim().toLowerCase();
    // Por fecha del evento (no por orden de llegada): igual que `ORDER BY at DESC` en Postgres.
    const matches = [...this.entries].sort((a, b) => b.at.getTime() - a.at.getTime()).filter(
      (entry) =>
        (!filters.action || entry.action === filters.action) &&
        (!filters.outcome || entry.outcome === filters.outcome) &&
        (!filters.subject || entry.subject === filters.subject) &&
        (!filters.actorUuid || entry.actorUuid === filters.actorUuid) &&
        (!filters.from || entry.at >= filters.from) &&
        (!filters.to || entry.at <= filters.to) &&
        (!term ||
          `${entry.actorEmail ?? ''} ${entry.route} ${entry.subject} ${entry.resourceUuid ?? ''}`.toLowerCase().includes(term)),
    );
    const start = (filters.page - 1) * filters.take;
    return Promise.resolve([matches.slice(start, start + filters.take), matches.length]);
  }

  findByUuid(uuid: string): Promise<IAuditLog | null> {
    return Promise.resolve(this.entries.find((entry) => entry.uuid === uuid) ?? null);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
