import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CU01/CU02: la evidencia pasa al bucket de objetos (los adjuntos guardan la clave, no el contenido), la encuesta registra
 * si se resolvió el problema y nace la tabla de tareas programadas (cierre automático configurable). Todo es ADITIVO y
 * conserva lo existente: los adjuntos antiguos siguen sirviéndose desde `content`.
 */
export class EvidenceBucketSurveyJobs1791000000000 implements MigrationInterface {
  name = 'EvidenceBucketSurveyJobs1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE ticket_attachments ADD COLUMN IF NOT EXISTS object_key varchar(300)');
    await queryRunner.query("ALTER TABLE ticket_attachments ADD COLUMN IF NOT EXISTS kind varchar(10) NOT NULL DEFAULT 'document'");
    await queryRunner.query('ALTER TABLE ticket_attachments ADD COLUMN IF NOT EXISTS duration_seconds integer');
    await queryRunner.query('ALTER TABLE ticket_attachments ALTER COLUMN content DROP NOT NULL');
    await queryRunner.query("UPDATE ticket_attachments SET kind = CASE WHEN mime_type LIKE 'image/%' THEN 'image' WHEN mime_type LIKE 'video/%' THEN 'video' ELSE 'document' END");
    await queryRunner.query('ALTER TABLE ticket_surveys ADD COLUMN IF NOT EXISTS resolved boolean');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        key              varchar(60) PRIMARY KEY,
        name             varchar(120) NOT NULL,
        description      varchar(300) NOT NULL DEFAULT '',
        enabled          boolean NOT NULL DEFAULT true,
        cron             varchar(120) NOT NULL,
        params           jsonb NOT NULL DEFAULT '{}',
        last_run_at      timestamptz,
        last_run_status  varchar(10),
        last_run_summary varchar(300),
        last_run_trigger varchar(254),
        updated_at       timestamptz NOT NULL,
        updated_by       varchar(254)
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS scheduled_jobs');
    await queryRunner.query('ALTER TABLE ticket_surveys DROP COLUMN IF EXISTS resolved');
    // Los adjuntos que solo existen en el bucket (sin `content`) no se pueden devolver a la base: se borran sus filas.
    await queryRunner.query('DELETE FROM ticket_attachments WHERE content IS NULL');
    await queryRunner.query('ALTER TABLE ticket_attachments ALTER COLUMN content SET NOT NULL');
    await queryRunner.query('ALTER TABLE ticket_attachments DROP COLUMN IF EXISTS duration_seconds');
    await queryRunner.query('ALTER TABLE ticket_attachments DROP COLUMN IF EXISTS kind');
    await queryRunner.query('ALTER TABLE ticket_attachments DROP COLUMN IF EXISTS object_key');
  }
}
