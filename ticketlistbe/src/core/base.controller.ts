import { NotFoundException } from '@nestjs/common';
import type { BaseEntity } from './base.entity.js';
import type { BaseService } from './base.service.js';
import type { IBasePagination } from './interfaces/Ibase-pagination.interface.js';
import type { IBaseController } from './interfaces/Ibase.controller.js';
import type { IPaginatedResult } from './interfaces/Ipaginated-result.interface.js';

/**
 * Capa de TRANSPORTE genérica: delega en el servicio. SIN decoradores de ruta a propósito: cada
 * controlador concreto los declara al sobreescribir (`@Get()`, `@CheckAbility`, `@ApiZod…`), así
 * cada endpoint deja explícito su permiso y su contrato OpenAPI (mismo patrón que
 * `AccountsController` de wallet-api, que sobreescribe todos los métodos).
 */
export abstract class BaseController<TEntity extends BaseEntity, TResponse, TCreate, TUpdate>
  implements IBaseController<TResponse, TCreate, TUpdate>
{
  protected constructor(protected readonly service: BaseService<TEntity, TResponse, TCreate, TUpdate>) {}

  findAll(pagination: IBasePagination): Promise<IPaginatedResult<TResponse>> {
    return this.service.findAll(pagination);
  }

  findOneByUuid({ uuid }: { uuid: string }): Promise<TResponse> {
    return this.service.findOneByUuid(uuid);
  }

  create(dto: TCreate): Promise<TResponse> {
    return this.service.create(dto);
  }

  update({ uuid }: { uuid: string }, dto: TUpdate): Promise<TResponse> {
    return this.service.update(uuid, dto);
  }

  softDeleteByUuid({ uuid }: { uuid: string }): Promise<void> {
    return this.service.softDelete(uuid);
  }

  restoreByUuid({ uuid }: { uuid: string }): Promise<void> {
    return this.service.restoreByUuid(uuid);
  }

  /** HEAD: 200 sin cuerpo si existe, 404 si no. */
  async existsByUuid({ uuid }: { uuid: string }): Promise<void> {
    if (!(await this.service.existsByUuid(uuid))) throw new NotFoundException();
  }
}
