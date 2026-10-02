import { PersistenceService } from '../../database/persistence.service.js';
import { MenuItemSchema } from '../../database/entity-schemas.js';
import { MenuItemEntity as MenuItemRow } from './menu-item.entity.js';
import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/base.repository.js';
import type { MenuItemEntity } from './menu-item.entity.js';
import { MENU_ITEMS_SEED } from './menu-items.seed.js';

@Injectable()
export class MenuItemsRepository extends InMemoryRepository<MenuItemEntity> {
  protected readonly searchableFields: (keyof MenuItemEntity)[] = ['key', 'label', 'route', 'group'];

  constructor(persistence: PersistenceService) {
    // `ensure`: un ítem de menú nuevo en un lanzamiento se agrega; lo que el administrador editó no se pisa.
    super(MENU_ITEMS_SEED, { service: persistence, schema: MenuItemSchema, create: () => new MenuItemRow(), seed: 'ensure', naturalKey: (row) => row.key });
  }

  /** Ítems vigentes y activos, en el orden del menú (`order`, luego nombre) — lo que consume el shell. */
  findActiveOrdered(): MenuItemEntity[] {
    return this.rows
      .filter((row) => row.active && !row.isDeleted)
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'));
  }

  existsKey(key: string, exceptUuid?: string): boolean {
    return this.rows.some((row) => !row.isDeleted && row.key === key && row.uuid !== exceptUuid);
  }
}
