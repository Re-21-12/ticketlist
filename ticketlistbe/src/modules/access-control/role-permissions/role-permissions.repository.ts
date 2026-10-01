import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../../core/base.repository.js';
import type { EUserRole } from '../../auth/casl/ability.enum.js';
import type { RolePermissionEntity } from './role-permission.entity.js';
import { ROLE_PERMISSIONS_SEED } from './role-permissions.seed.js';

@Injectable()
export class RolePermissionsRepository extends InMemoryRepository<RolePermissionEntity> {
  protected readonly searchableFields: (keyof RolePermissionEntity)[] = ['role', 'subject', 'action'];

  constructor() {
    super(ROLE_PERMISSIONS_SEED);
  }

  /** Permisos vigentes de un rol — la fuente de `CaslAbilityFactory` (DB-first). */
  findActiveByRole(role: EUserRole): RolePermissionEntity[] {
    return this.rows.filter((row) => row.role === role && !row.isDeleted);
  }

  existsDuplicate(row: Pick<RolePermissionEntity, 'role' | 'subject' | 'action' | 'condition'>, exceptUuid?: string): boolean {
    return this.rows.some(
      (r) =>
        !r.isDeleted &&
        r.uuid !== exceptUuid &&
        r.role === row.role &&
        r.subject === row.subject &&
        r.action === row.action &&
        r.condition === row.condition,
    );
  }
}
