import { Module } from '@nestjs/common';
import { MenuItemsController } from './menu-items.controller.js';

@Module({ controllers: [MenuItemsController] })
export class MenuItemsHttpModule {}
