import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Contraseñas temporales de un solo uso entregadas por la administración (aditivo). */
export class UserTempPassword1791100000000 implements MigrationInterface {
  name = 'UserTempPassword1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false');
    await queryRunner.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires_at timestamptz');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS temp_password_expires_at');
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS must_change_password');
  }
}
