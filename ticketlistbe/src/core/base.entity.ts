import type { IBaseEntity } from './interfaces/Ibase-entity.interface.js';

/**
 * Columnas comunes (auditoría + borrado lógico + restauración), igual que wallet-api. Hoy es una
 * clase plana porque el repositorio es en memoria; al elegir ORM (TypeORM/Drizzle) aquí van los
 * decoradores de columna y el resto de capas no cambia.
 */
export abstract class BaseEntity implements IBaseEntity {
  id!: number;
  uuid!: string;
  createdAt!: Date;
  createdBy!: string | null;
  updatedAt!: Date | null;
  updatedBy!: string | null;
  deletedAt!: Date | null;
  deletedBy!: string | null;
  isDeleted!: boolean;
  restoredAt!: Date | null;
  restoredBy!: string | null;
}
