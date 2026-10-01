import { Global, Module } from '@nestjs/common';
import { RolePermissionsRepository } from './role-permissions.repository.js';
import { RolePermissionsService } from './role-permissions.service.js';

/** Dominio. Global porque `CaslAbilityFactory` lee los permisos en cada request (DB-first). */
@Global()
@Module({
  providers: [RolePermissionsRepository, RolePermissionsService],
  exports: [RolePermissionsRepository, RolePermissionsService],
})
export class RolePermissionsModule {}
