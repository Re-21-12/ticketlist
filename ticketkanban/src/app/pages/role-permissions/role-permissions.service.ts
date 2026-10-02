import { Service, signal } from '@angular/core';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { RolePermissionSchema } from './role-permission.schema';
import type { TRolePermission, TRolePermissionUpsert } from './role-permission.types';

/** Acceso HTTP de `/api/role-permissions` (CRUD heredado de `BaseApiAbstract`). Solo ADMIN. */
@Service()
export class RolePermissionsService extends BaseApiAbstract<
  TRolePermission,
  TRolePermissionUpsert,
  TRolePermissionUpsert
> {
  protected readonly endpoint = '/api/role-permissions';
  protected readonly $uuid = signal<string | undefined>(undefined);

  protected override parseItem(raw: unknown): TRolePermission {
    return RolePermissionSchema.parse(raw);
  }
}
