import type { IBasePagination } from './Ibase-pagination.interface.js';
import type { IPaginatedResult } from './Ipaginated-result.interface.js';

/**
 * Capa de TRANSPORTE: HTTP ↔ servicio. Es el contrato que espeja `BaseApiAbstract` del front
 * (GET / · GET /:uuid · POST · PATCH /:uuid · DELETE /:uuid · PATCH /:uuid/restore · HEAD /:uuid).
 */
export interface IBaseController<TResponse, TCreate, TUpdate> {
  findAll(pagination: IBasePagination): Promise<IPaginatedResult<TResponse>>;
  findOneByUuid(param: { uuid: string }): Promise<TResponse>;
  create(dto: TCreate): Promise<TResponse>;
  update(param: { uuid: string }, dto: TUpdate): Promise<TResponse>;
  softDeleteByUuid(param: { uuid: string }): Promise<void>;
  restoreByUuid(param: { uuid: string }): Promise<void>;
  existsByUuid(param: { uuid: string }): Promise<void>;
}
