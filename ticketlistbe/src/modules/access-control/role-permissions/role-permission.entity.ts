import { BaseEntity } from '../../../core/base.entity.js';
import type { EAbility, EUserRole } from '../../auth/casl/ability.enum.js';
import type { TConditionPreset, TSubjects } from '../../auth/casl/casl.types.js';

/** Fila de `role_permissions`: el rol `role` puede `action` sobre `subject` bajo `condition`. */
export class RolePermissionEntity extends BaseEntity {
  role!: EUserRole;
  subject!: TSubjects;
  action!: EAbility;
  condition!: TConditionPreset;
}
