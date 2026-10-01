import type { INavItem } from '../../layouts/layout/layout.interface';
import { EAbility, type EUserRole } from './ability.enum';
import type { TAbilityAction, TSubjects } from './casl.types';

/**
 * Cualquier cosa con el `.can()` de `AbilityServiceSignal` (la sesión propia) o un `Ability`
 * armado a mano (`createMongoAbility(rules)` de OTRO usuario). Mínimo a propósito: el util no
 * depende de Angular.
 */
export interface ICanCheck {
  can(action: TAbilityAction, subject: TSubjects): boolean;
}

/**
 * ¿Se ve este ítem del menú? (port de wallet-api). Sin `subject` = siempre visible; con
 * `subject`, se exige `requiredAction` (default `read`) y que el rol no esté en `hiddenForRoles`.
 */
export function isMenuItemVisible(
  item: INavItem,
  ability: ICanCheck,
  activeRole: EUserRole | undefined,
): boolean {
  const hiddenByRole = !!activeRole && !!item.hiddenForRoles?.includes(activeRole);
  const allowed = !item.subject || ability.can(item.requiredAction ?? EAbility.READ, item.subject);
  return allowed && !hiddenByRole;
}

export function resolveVisibleMenuItems(
  items: readonly INavItem[],
  ability: ICanCheck,
  activeRole: EUserRole | undefined,
): INavItem[] {
  return items.filter((item) => isMenuItemVisible(item, ability, activeRole));
}
