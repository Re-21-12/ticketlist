import type { IBasePagination } from './Ibase-pagination.interface.js';

/** Filtro/alcance simple por igualdad (en TypeORM sería `FindOptionsWhere<T>`). */
export type TWhere<T> = Partial<T>;

/**
 * Filtro por fila calculado en el servicio (p. ej. `ability.can('read', fila)`), aplicado ANTES de
 * paginar. En memoria es un predicado; con un ORM se traduce a SQL (`rulesToQuery`/`accessibleBy`
 * de CASL) — el contrato del servicio no cambia.
 */
export type TRowPredicate<T> = (row: T) => boolean;

/** Capa de DATOS: solo persistencia, sin reglas de negocio ni permisos. */
export interface IBaseRepository<T> {
  findAll(
    pagination: IBasePagination,
    filters?: TWhere<T>,
    scope?: TWhere<T>,
    rowFilter?: TRowPredicate<T>,
  ): Promise<[T[], number]>;
  findByUuid(uuid: string, scope?: TWhere<T>): Promise<T | null>;
  create(entity: T): Promise<T>;
  update(entity: T): Promise<T>;
  softDeleteByUuid(uuid: string, deletedBy: string): Promise<void>;
  restoreByUuid(uuid: string, restoredBy: string): Promise<void>;
  existsByUuid(uuid: string, scope?: TWhere<T>): Promise<boolean>;
}
