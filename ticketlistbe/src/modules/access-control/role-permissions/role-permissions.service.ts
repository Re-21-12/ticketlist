import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type * as z from 'zod';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { BaseService } from '../../../core/base.service.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { CaslAbilityFactory } from '../../auth/casl/casl-ability.factory.js';
import type { TSubjects } from '../../auth/casl/casl.types.js';
import type { TRolePermissionResponse } from './dtos/role-permission.dtos.js';
import { RolePermissionEntity } from './role-permission.entity.js';
import { RolePermissionsRepository } from './role-permissions.repository.js';
import {
  RolePermissionResponseSchema,
  type RolePermissionCreateSchema,
  type RolePermissionUpdateSchema,
} from './schemas/role-permission.schema.js';

type TCreate = z.output<typeof RolePermissionCreateSchema>;
type TUpdate = z.output<typeof RolePermissionUpdateSchema>;

/**
 * RBAC DB-first (pantalla «Permisos por rol» de wallet-api). Un cambio aquí rige desde la
 * SIGUIENTE request: `CaslAbilityFactory` lee el repositorio en cada una. El front ve el cambio al
 * recargar el shell (`GET /api/bff/shell`) — mismo matiz que `ability-refresh.service.ts` de wallet-api.
 */
@Injectable()
export class RolePermissionsService extends BaseService<
  RolePermissionEntity,
  TRolePermissionResponse,
  TCreate,
  TUpdate
> {
  protected readonly codes = ERROR_CODES.RPM;
  protected readonly caslSubject: TSubjects = 'RolePermission';

  constructor(
    protected override readonly repository: RolePermissionsRepository,
    abilityFactory: CaslAbilityFactory,
  ) {
    super(repository, abilityFactory);
  }

  override async create(dto: TCreate): Promise<TRolePermissionResponse> {
    if (this.repository.existsDuplicate(dto)) {
      throw new CustomBusinessException(ERROR_CODES.RPM.DUPLICATED, { entity: 'RolePermission' });
    }
    return super.create(dto);
  }

  override async update(uuid: string, dto: TUpdate): Promise<TRolePermissionResponse> {
    if (this.repository.existsDuplicate(dto, uuid)) {
      throw new CustomBusinessException(ERROR_CODES.RPM.DUPLICATED, { entity: 'RolePermission', uuid });
    }
    return super.update(uuid, dto);
  }

  protected toEntity(dto: TCreate, createdBy: string): RolePermissionEntity {
    return Object.assign(new RolePermissionEntity(), dto, {
      uuid: randomUUID(),
      createdAt: new Date(),
      createdBy,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      isDeleted: false,
      restoredAt: null,
      restoredBy: null,
    });
  }

  protected mergeEntity(entity: RolePermissionEntity, dto: TUpdate, updatedBy: string): RolePermissionEntity {
    return Object.assign(new RolePermissionEntity(), entity, dto, { updatedAt: new Date(), updatedBy });
  }

  protected toResponse(entity: RolePermissionEntity): TRolePermissionResponse {
    return RolePermissionResponseSchema.parse({
      uuid: entity.uuid,
      role: entity.role,
      subject: entity.subject,
      action: entity.action,
      condition: entity.condition,
      createdAt: entity.createdAt.toISOString(),
    });
  }
}
