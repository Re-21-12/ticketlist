import type { z } from 'zod';
import type { RolePermissionSchema, RolePermissionUpsertSchema } from './role-permission.schema';

export type TRolePermission = z.output<typeof RolePermissionSchema>;
export type TRolePermissionUpsert = z.output<typeof RolePermissionUpsertSchema>;
