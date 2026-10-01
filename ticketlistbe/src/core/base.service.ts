import { subject as asSubject } from '@casl/ability';
import { ERROR_CODES } from '../common/codes/error-codes.js';
import { EAbility } from '../modules/auth/casl/ability.enum.js';
import type { CaslAbilityFactory } from '../modules/auth/casl/casl-ability.factory.js';
import type { TSubjects } from '../modules/auth/casl/casl.types.js';
import type { BaseEntity } from './base.entity.js';
import { RequestContext } from './context/request-context.js';
import { CustomBusinessException } from './exceptions/app.exception.js';
import type { IBasePagination } from './interfaces/Ibase-pagination.interface.js';
import type { IBaseRepository, TWhere } from './interfaces/Ibase.repository.js';
import type { IBaseService } from './interfaces/Ibase.service.js';
import type { IServiceErrorCodes } from './interfaces/Icustom-code.interface.js';
import type { IPaginatedResult } from './interfaces/Ipaginated-result.interface.js';
import { buildEtag, etagMatches } from './utils/etag.util.js';

/**
 * Capa de NEGOCIO genérica (port de `BaseService` de wallet-api): CRUD con borrado lógico,
 * auditoría (createdBy/updatedBy/…), códigos de error por módulo y permisos por REGISTRO con CASL
 * (reglas con condiciones que el guard, a nivel de tipo, no puede evaluar).
 *
 * La subclase solo implementa el mapeo: `toEntity`, `mergeEntity`, `toResponse` — y en
 * `toResponse` parsea con su schema Zod de respuesta, así lo que sale cumple el contrato OpenAPI.
 */
export abstract class BaseService<TEntity extends BaseEntity, TResponse, TCreate, TUpdate>
  implements IBaseService<TEntity, TResponse, TCreate, TUpdate>
{
  protected abstract readonly codes: IServiceErrorCodes;
  protected abstract readonly caslSubject: TSubjects;

  protected constructor(
    protected readonly repository: IBaseRepository<TEntity>,
    protected readonly abilityFactory: CaslAbilityFactory,
  ) {}

  protected abstract toEntity(dto: TCreate, createdBy: string): TEntity;
  protected abstract mergeEntity(entity: TEntity, dto: TUpdate, updatedBy: string): TEntity;
  protected abstract toResponse(entity: TEntity): TResponse;

  /** Alcance de lectura por usuario (p. ej. `{ ownerUuid }`); por defecto, sin restricción. */
  protected readScope(): TWhere<TEntity> | undefined {
    return undefined;
  }

  protected getActor(): string {
    return RequestContext.currentUser()?.uuid ?? 'system';
  }

  /** Permiso sobre un registro concreto (evalúa condiciones como `assigneeEmail`). */
  protected assertCan(action: EAbility, entity: TEntity): void {
    const ability = this.abilityFactory.createForUser(RequestContext.currentUser());
    // Copia plana: `subject()` de CASL marca el objeto y no queremos mutar la entidad.
    if (!ability.can(action, asSubject(this.caslSubject, Object.assign({}, entity)))) {
      throw new CustomBusinessException(ERROR_CODES.AUT.FORBIDDEN, {
        entity: this.caslSubject,
        uuid: entity.uuid,
      });
    }
  }

  /**
   * Concurrencia optimista (RFC 9110 §13.1.1): si la request trae `If-Match`, debe coincidir con
   * el ETag de la representación ACTUAL (el mismo que devolvió el GET); si no → 412 `SCONC-E001`.
   * Sin `If-Match` es no-op (retrocompatible), igual que `assertIfMatch` de wallet-api.
   */
  protected assertIfMatch(current: TEntity): void {
    const ifMatch = RequestContext.ifMatch();
    if (!ifMatch) return;
    if (!etagMatches(ifMatch, buildEtag(this.toResponse(current)))) {
      throw new CustomBusinessException(ERROR_CODES.CONC.VERSION_MISMATCH, {
        entity: this.caslSubject,
        uuid: current.uuid,
      });
    }
  }

  /** Hooks de dominio (p. ej. notificaciones). No-op por defecto; no deben lanzar. */
  protected onCreated(_created: TEntity): void {}
  protected onUpdated(_before: TEntity, _after: TEntity): void {}

  /**
   * Filtro de LECTURA por fila con el mismo Ability que el guard. El guard solo decide por TIPO
   * (`can('read', 'Ticket')` es true si existe CUALQUIER regla de lectura, incluida «solo las mías»);
   * sin este filtro, un usuario con solo la regla de titular veía TODAS las filas (bug real
   * detectado por el e2e de RBAC). Evalúa condiciones, concesiones ReBAC ($in) y presets.
   */
  protected readableRowFilter(): (row: TEntity) => boolean {
    const ability = this.abilityFactory.createForUser(RequestContext.currentUser());
    return (row) => ability.can(EAbility.READ, asSubject(this.caslSubject, Object.assign({}, row)));
  }

  /** Inexistente O no legible → mismo 404: no se revela que la fila existe. */
  protected async findOrFail(uuid: string): Promise<TEntity> {
    const entity = await this.repository.findByUuid(uuid, this.readScope());
    if (!entity || !this.readableRowFilter()(entity)) {
      throw new CustomBusinessException(this.codes.NOT_FOUND, { uuid });
    }
    return entity;
  }

  async findAll(pagination: IBasePagination, filters?: TWhere<TEntity>): Promise<IPaginatedResult<TResponse>> {
    const [rows, total] = await this.repository.findAll(
      pagination,
      filters,
      this.readScope(),
      this.readableRowFilter(),
    );
    return {
      data: rows.map((row) => this.toResponse(row)),
      meta: { total, page: pagination.page, take: pagination.take },
    };
  }

  async findOneByUuid(uuid: string): Promise<TResponse> {
    const entity = await this.findOrFail(uuid);
    if (entity.isDeleted && this.codes.ALREADY_DELETED) {
      throw new CustomBusinessException(this.codes.ALREADY_DELETED, { uuid });
    }
    return this.toResponse(entity);
  }

  async create(dto: TCreate): Promise<TResponse> {
    const saved = await this.repository.create(this.toEntity(dto, this.getActor()));
    this.onCreated(saved);
    return this.toResponse(saved);
  }

  async update(uuid: string, dto: TUpdate): Promise<TResponse> {
    const current = await this.findOrFail(uuid);
    this.assertCan(EAbility.UPDATE, current);
    this.assertIfMatch(current);
    const saved = await this.repository.update(this.mergeEntity(current, dto, this.getActor()));
    this.onUpdated(current, saved);
    return this.toResponse(saved);
  }

  async softDelete(uuid: string): Promise<void> {
    const current = await this.findOrFail(uuid);
    this.assertCan(EAbility.DELETE, current);
    this.assertIfMatch(current);
    await this.repository.softDeleteByUuid(uuid, this.getActor());
  }

  async restoreByUuid(uuid: string): Promise<void> {
    const current = await this.findOrFail(uuid);
    if (!current.isDeleted && this.codes.NOT_DELETED) {
      throw new CustomBusinessException(this.codes.NOT_DELETED, { uuid });
    }
    this.assertCan(EAbility.RESTORE, current);
    await this.repository.restoreByUuid(uuid, this.getActor());
  }

  existsByUuid(uuid: string): Promise<boolean> {
    return this.repository.existsByUuid(uuid, this.readScope());
  }
}
