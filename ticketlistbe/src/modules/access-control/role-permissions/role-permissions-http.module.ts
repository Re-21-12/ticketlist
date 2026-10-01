import { Module } from '@nestjs/common';
import { RolePermissionsController } from './role-permissions.controller.js';

@Module({ controllers: [RolePermissionsController] })
export class RolePermissionsHttpModule {}
