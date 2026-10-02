import { Pool } from 'pg';
import type { IAuditLog, TAuditAction, TAuditOutcome } from './audit-log.entity.js';
import type { IAuditFilters, IAuditLogStore } from './audit-log.store.js';

/**
 * Tabla del registro. La inmutabilidad se garantiza a nivel de API, como en wallet-api: el store solo
 * expone `append` y lecturas (no hay update ni delete que llamar) y el controlador solo tiene GET. Es
 * idempotente: se puede ejecutar en cada arranque. En producción conviene además quitarle UPDATE/DELETE
 * sobre `audit_logs` al rol de BD de la app (defensa en profundidad, fuera del código).
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_logs (
  uuid          uuid PRIMARY KEY,
  at            timestamptz NOT NULL,
  action        text NOT NULL,
  subject       text NOT NULL,
  route         text NOT NULL,
  method        text NOT NULL,
  resource_uuid text,
  status        integer NOT NULL,
  outcome       text NOT NULL,
  actor_uuid    text,
  actor_email   text,
  actor_role    text,
  ip            text NOT NULL,
  user_agent    text NOT NULL,
  request_id    text,
  changed_fields text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_uuid, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON audit_logs (subject, at DESC);
-- Versiones anteriores bloqueaban UPDATE/DELETE con un trigger; la inmutabilidad ahora es de la API.
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
DROP FUNCTION IF EXISTS audit_logs_immutable();
`;

interface IRow {
  uuid: string;
  at: Date;
  action: TAuditAction;
  subject: string;
  route: string;
  method: string;
  resource_uuid: string | null;
  status: number;
  outcome: TAuditOutcome;
  actor_uuid: string | null;
  actor_email: string | null;
  actor_role: string | null;
  ip: string;
  user_agent: string;
  request_id: string | null;
  changed_fields: string[];
}

const toEntry = (row: IRow): IAuditLog => ({
  uuid: row.uuid,
  at: row.at,
  action: row.action,
  subject: row.subject,
  route: row.route,
  method: row.method,
  resourceUuid: row.resource_uuid,
  status: row.status,
  outcome: row.outcome,
  actorUuid: row.actor_uuid,
  actorEmail: row.actor_email,
  actorRole: row.actor_role,
  ip: row.ip,
  userAgent: row.user_agent,
  requestId: row.request_id,
  changedFields: row.changed_fields,
});

/** Escapa `%`, `_` y `\` para que la búsqueda de texto sea LITERAL (no un patrón del usuario). */
const likeLiteral = (term: string): string => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Auditoría en Postgres (`DATABASE_URL`). Todo con parámetros: nada del usuario se concatena al SQL. */
export class PostgresAuditLogStore implements IAuditLogStore {
  private constructor(private readonly pool: Pool) {}

  static async connect(connectionString: string): Promise<PostgresAuditLogStore> {
    const pool = new Pool({ connectionString, max: 5 });
    // Varias réplicas (o varios tests) arrancan a la vez: el candado evita que dos DDL se pisen.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(727001)');
      await client.query(SCHEMA);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return new PostgresAuditLogStore(pool);
  }

  async append(entry: IAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (uuid, at, action, subject, route, method, resource_uuid, status, outcome,
         actor_uuid, actor_email, actor_role, ip, user_agent, request_id, changed_fields)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        entry.uuid, entry.at, entry.action, entry.subject, entry.route, entry.method, entry.resourceUuid,
        entry.status, entry.outcome, entry.actorUuid, entry.actorEmail, entry.actorRole, entry.ip,
        entry.userAgent, entry.requestId, entry.changedFields,
      ],
    );
  }

  async findAll(filters: IAuditFilters): Promise<[IAuditLog[], number]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown): void => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (filters.action) add('action = ?', filters.action);
    if (filters.outcome) add('outcome = ?', filters.outcome);
    if (filters.subject) add('subject = ?', filters.subject);
    if (filters.actorUuid) add('actor_uuid = ?', filters.actorUuid);
    if (filters.from) add('at >= ?', filters.from);
    if (filters.to) add('at <= ?', filters.to);
    const term = filters.search?.trim();
    if (term) {
      add(`(COALESCE(actor_email,'') || ' ' || route || ' ' || subject || ' ' || COALESCE(resource_uuid,'')) ILIKE ? ESCAPE '\\'`, likeLiteral(term));
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await this.pool.query<{ count: string }>(`SELECT count(*) FROM audit_logs ${clause}`, params);
    const rows = await this.pool.query<IRow>(
      `SELECT * FROM audit_logs ${clause} ORDER BY at DESC, uuid DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filters.take, (filters.page - 1) * filters.take],
    );
    return [rows.rows.map(toEntry), Number(total.rows[0]?.count ?? 0)];
  }

  async findByUuid(uuid: string): Promise<IAuditLog | null> {
    const result = await this.pool.query<IRow>('SELECT * FROM audit_logs WHERE uuid = $1', [uuid]);
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
