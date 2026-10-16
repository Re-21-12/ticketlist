import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El catálogo de estados usa los nombres del documento de requisitos: «Nuevo» → «Abierto» y «En atención» → «En progreso».
 * La semilla del catálogo NO pisa lo que ya existe (el administrador puede renombrar), así que esta migración solo cambia las
 * filas que todavía llevan el nombre de fábrica: un nombre que alguien ya personalizó no se toca.
 */
export class TicketStatusLabels1791300000000 implements MigrationInterface {
  name = 'TicketStatusLabels1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE catalog_items SET label = 'Abierto' WHERE catalog_key = 'ticket-status' AND code = 'new' AND label = 'Nuevo'");
    await queryRunner.query("UPDATE catalog_items SET label = 'En progreso' WHERE catalog_key = 'ticket-status' AND code = 'in_progress' AND label = 'En atención'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE catalog_items SET label = 'Nuevo' WHERE catalog_key = 'ticket-status' AND code = 'new' AND label = 'Abierto'");
    await queryRunner.query("UPDATE catalog_items SET label = 'En atención' WHERE catalog_key = 'ticket-status' AND code = 'in_progress' AND label = 'En progreso'");
  }
}
