import * as z from 'zod';
import { EAbility, EUserRole } from '../../core/casl/ability.enum';
import { CONDITION_PRESETS } from '../../core/casl/casl-labels.constants';
import { SUBJECTS } from '../../core/casl/casl.types';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';

/**
 * CONTRATO de `role_permissions` (RBAC + ABAC por preset). Espejo de
 * ticketlistbe/src/modules/access-control/role-permissions/schemas/role-permission.schema.ts.
 */
export const RolePermissionUpsertSchema = z.object({
  role: z.enum(EUserRole, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un rol' }) }),
  subject: z.enum(SUBJECTS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un recurso' }) }),
  action: z.enum(EAbility, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una acción' }) }),
  condition: z
    .enum(CONDITION_PRESETS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una condición' }) })
    .default('NONE'),
});

export const RolePermissionSchema = RolePermissionUpsertSchema.extend({
  uuid: z.uuid(),
  createdAt: z.iso.datetime(),
});
