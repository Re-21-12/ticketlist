import type { EUserRole } from '../../core/casl/ability.enum';
import type { TAbilityAction, TSubjects } from '../../core/casl/casl.types';

export interface INavItem {
  /** Clave única para `@for … track` (la ruta no sirve: dos ítems pueden apuntar a la misma). */
  key: string;
  label: string;
  route: string;
  /** Submenú al que pertenece; sin grupo = ítem de primer nivel. */
  group?: string;
  /** Si se define, el ítem solo se ve si la sesión puede `requiredAction` sobre este subject. */
  subject?: TSubjects;
  /** Acción exigida sobre `subject` (default `read`). */
  requiredAction?: TAbilityAction;
  /** Roles a los que se oculta aunque tengan la habilidad. */
  hiddenForRoles?: EUserRole[];
}

/** Nodo del árbol del sidebar: un ítem suelto o un grupo con sus ítems. */
export type TNavNode =
  | { kind: 'item'; item: INavItem }
  | { kind: 'group'; label: string; items: INavItem[] };
