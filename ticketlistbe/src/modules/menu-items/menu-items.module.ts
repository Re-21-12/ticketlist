import { Global, Module } from '@nestjs/common';
import { MenuItemsRepository } from './menu-items.repository.js';
import { MenuItemsService } from './menu-items.service.js';

/** Dominio. Global porque el BFF del shell arma el menú desde este repositorio. */
@Global()
@Module({
  providers: [MenuItemsRepository, MenuItemsService],
  exports: [MenuItemsRepository, MenuItemsService],
})
export class MenuItemsModule {}
