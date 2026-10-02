import { EAbility, type EUserRole } from '../../core/casl/ability.enum';
import type { TSubjects } from '../../core/casl/casl.types';
import type { TRolePermission } from '../role-permissions/role-permission.types';

/**
 * Estado de una celda (rol × recurso × acción) de la matriz:
 *  - `on`        → hay un permiso DIRECTO del rol para esa acción sobre ese recurso (se puede quitar aquí).
 *  - `inherited` → lo concede «Administrar» (`manage`) o «Todo el sistema» (`all`): no se apaga desde la
 *                  matriz, habría que editar esa regla en «Permisos por rol».
 *  - `off`       → el rol no puede.
 */
export type TCellState = 'on' | 'inherited' | 'off';

export interface IMatrixCell {
  state: TCellState;
  /** Reglas directas que respaldan la celda (puede haber una por condición). */
  rules: TRolePermission[];
  /** Hay alguna con condición distinta de `NONE`: el permiso es parcial («solo lo asignado»). */
  conditional: boolean;
}

/** Acciones que la matriz muestra como columnas (`manage` es el «todo», no una columna). */
export const MATRIX_ACTIONS = [EAbility.CREATE, EAbility.READ, EAbility.UPDATE, EAbility.DELETE, EAbility.RESTORE] as const;

export function cellFor(
  rules: readonly TRolePermission[],
  role: EUserRole,
  subject: TSubjects,
  action: EAbility,
): IMatrixCell {
  const ofRole = rules.filter((rule) => rule.role === role);
  const direct = ofRole.filter((rule) => rule.subject === subject && rule.action === action);
  if (direct.length) {
    return { state: 'on', rules: direct, conditional: direct.every((rule) => rule.condition !== 'NONE') };
  }
  const inheritedBy = ofRole.filter(
    (rule) =>
      (rule.subject === subject || rule.subject === 'all') &&
      (rule.action === EAbility.MANAGE || (rule.subject === 'all' && rule.action === action)),
  );
  if (inheritedBy.length) {
    return { state: 'inherited', rules: inheritedBy, conditional: inheritedBy.every((rule) => rule.condition !== 'NONE') };
  }
  return { state: 'off', rules: [], conditional: false };
}

/** ¿El rol tiene alguna acción sobre el recurso? (filtro «con algún permiso» de la matriz). */
export function hasAnyAccess(rules: readonly TRolePermission[], role: EUserRole, subject: TSubjects): boolean {
  return MATRIX_ACTIONS.some((action) => cellFor(rules, role, subject, action).state !== 'off');
}
