import type { IBasePagination } from './Ibase-pagination.interface.js';
import type { IPaginatedResult } from './Ipaginated-result.interface.js';
import type { TWhere } from './Ibase.repository.js';

/** Capa de NEGOCIO: reglas, alcance por usuario y mapeo entidad → DTO de respuesta. */
export interface IBaseService<TEntity, TResponse, TCreate, TUpdate> {
  findAll(pagination: IBasePagination, filters?: TWhere<TEntity>): Promise<IPaginatedResult<TResponse>>;
  findOneByUuid(uuid: string): Promise<TResponse>;
  create(dto: TCreate): Promise<TResponse>;
  update(uuid: string, dto: TUpdate): Promise<TResponse>;
  softDelete(uuid: string): Promise<void>;
  restoreByUuid(uuid: string): Promise<void>;
  existsByUuid(uuid: string): Promise<boolean>;
}
