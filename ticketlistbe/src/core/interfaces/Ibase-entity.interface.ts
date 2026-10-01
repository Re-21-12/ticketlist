/** Columnas comunes a toda entidad (mismo set que `BaseEntity` de wallet-api: auditoría + borrado lógico). */
export interface IBaseEntity {
  id: number;
  uuid: string;
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  isDeleted: boolean;
  restoredAt: Date | null;
  restoredBy: string | null;
}
