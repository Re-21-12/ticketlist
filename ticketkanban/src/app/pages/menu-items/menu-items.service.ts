import { Service, signal } from '@angular/core';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { MenuItemSchema } from './menu-item.schema';
import type { TMenuItem, TMenuItemUpsert } from './menu-item.types';

/** Acceso HTTP de `/api/menu-items` (CRUD heredado de `BaseApiAbstract`). Solo ADMIN. */
@Service()
export class MenuItemsService extends BaseApiAbstract<TMenuItem, TMenuItemUpsert, TMenuItemUpsert> {
  protected readonly endpoint = '/api/menu-items';
  protected readonly $uuid = signal<string | undefined>(undefined);

  /** El menú ordena por `order`; el backend pagina por fecha, así que se pide una página grande. */
  constructor() {
    super();
    this.setTake(50);
  }

  protected override parseItem(raw: unknown): TMenuItem {
    return MenuItemSchema.parse(raw);
  }
}
