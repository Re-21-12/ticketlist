import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Códigos de recuperación de un solo uso del autenticador (solo sus huellas HMAC; aditivo). */
export class RecoveryCodes1791200000000 implements MigrationInterface {
  name = 'RecoveryCodes1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS recovery_codes');
  }
}
