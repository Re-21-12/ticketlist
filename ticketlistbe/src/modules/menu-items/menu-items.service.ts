import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { BaseService } from '../../core/base.service.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory.js';
import type { TSubjects } from '../auth/casl/casl.types.js';
import type { TMenuItemResponse } from './dtos/menu-item.dtos.js';
import { MenuItemEntity } from './menu-item.entity.js';
import { MenuItemsRepository } from './menu-items.repository.js';
import {
  MenuItemResponseSchema,
  type MenuItemCreateSchema,
  type MenuItemUpdateSchema,
} from './schemas/menu-item.schema.js';

type TCreate = z.output<typeof MenuItemCreateSchema>;
type TUpdate = z.output<typeof MenuItemUpdateSchema>;

/** Menú administrable (pantalla «Menú» de wallet-api). Un cambio rige desde la siguiente carga del shell. */
@Injectable()
export class MenuItemsService extends BaseService<MenuItemEntity, TMenuItemResponse, TCreate, TUpdate> {
  protected readonly codes = ERROR_CODES.MNU;
  protected readonly caslSubject: TSubjects = 'MenuItem';

  constructor(
    protected override readonly repository: MenuItemsRepository,
    abilityFactory: CaslAbilityFactory,
  ) {
    super(repository, abilityFactory);
  }

  override async create(dto: TCreate): Promise<TMenuItemResponse> {
    if (this.repository.existsKey(dto.key)) {
      throw new CustomBusinessException(ERROR_CODES.MNU.DUPLICATED_KEY, { entity: 'MenuItem' });
    }
    return super.create(dto);
  }

  override async update(uuid: string, dto: TUpdate): Promise<TMenuItemResponse> {
    if (this.repository.existsKey(dto.key, uuid)) {
      throw new CustomBusinessException(ERROR_CODES.MNU.DUPLICATED_KEY, { entity: 'MenuItem', uuid });
    }
    return super.update(uuid, dto);
  }

  protected toEntity(dto: TCreate, createdBy: string): MenuItemEntity {
    return Object.assign(new MenuItemEntity(), dto, {
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

  protected mergeEntity(entity: MenuItemEntity, dto: TUpdate, updatedBy: string): MenuItemEntity {
    return Object.assign(new MenuItemEntity(), entity, dto, { updatedAt: new Date(), updatedBy });
  }

  protected toResponse(entity: MenuItemEntity): TMenuItemResponse {
    return MenuItemResponseSchema.parse({
      uuid: entity.uuid,
      key: entity.key,
      label: entity.label,
      route: entity.route,
      group: entity.group,
      icon: entity.icon,
      subject: entity.subject,
      requiredAction: entity.requiredAction,
      order: entity.order,
      active: entity.active,
      createdAt: entity.createdAt.toISOString(),
    });
  }
}
