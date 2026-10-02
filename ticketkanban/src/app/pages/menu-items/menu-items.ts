import { Component, inject } from '@angular/core';
import { CrudPage } from '../../shared/crud-page/crud-page';
import { MENU_ITEM_CRUD } from './menu-item-form.config';
import { MenuItemsService } from './menu-items.service';

/** «Menú»: ítems del menú lateral y quién los ve (CASL). Un cambio rige desde la siguiente carga de sesión. */
@Component({
  selector: 'app-menu-items',
  imports: [CrudPage],
  templateUrl: './menu-items.html',
  styleUrl: './menu-items.css',
})
export class MenuItems {
  protected readonly _service = inject(MenuItemsService);
  protected readonly config = MENU_ITEM_CRUD;
}
