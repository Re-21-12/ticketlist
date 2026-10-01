import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../../common/codes/validation-errors.js';
import { EAbility, EUserRole } from '../../../auth/casl/ability.enum.js';
import { CONDITION_PRESETS, SUBJECTS } from '../../../auth/casl/casl.types.js';

/** Contrato de `role_permissions` (RBAC + ABAC por preset). */
export const RolePermissionBaseSchema = z.object({
  role: z.enum(EUserRole, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un rol' }) }),
  subject: z.enum(SUBJECTS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un recurso' }) }),
  action: z.enum(EAbility, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una acción' }) }),
  condition: z
    .enum(CONDITION_PRESETS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una condición' }) })
    .default('NONE'),
});

export const RolePermissionCreateSchema = RolePermissionBaseSchema;
export const RolePermissionUpdateSchema = RolePermissionBaseSchema;

export const RolePermissionResponseSchema = RolePermissionBaseSchema.extend({
  uuid: z.uuid(),
  createdAt: z.iso.datetime(),
});

export const RolePermissionFilterSchema = z.object({
  role: z.enum(EUserRole).optional(),
  subject: z.enum(SUBJECTS).optional(),
});
