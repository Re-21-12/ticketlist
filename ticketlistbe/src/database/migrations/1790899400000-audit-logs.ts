import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `audit_logs` (registro inmutable de cambios y accesos). Es la MISMA definición que crea `PostgresAuditLogStore` al
 * conectar (idempotente): con esta migración el esquema completo vive en un solo lugar y el almacén solo la reafirma.
 * Es de solo añadir A NIVEL DE API (sin UPDATE/DELETE en el código); en producción conviene además quitarle esos
 * permisos al rol de la app.
 */
export class AuditLogs1790899400000 implements MigrationInterface {
  name = 'AuditLogs1790899400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
      )`);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_at ON audit_logs (at DESC)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_uuid, at DESC)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_subject ON audit_logs (subject, at DESC)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS audit_logs');
  }
}
