import { BaseEntity } from '../../core/base.entity.js';
import type { EAbility } from '../auth/casl/ability.enum.js';
import type { TSubjects } from '../auth/casl/casl.types.js';

/** Fila de `menu_items`: un destino del menú lateral y quién lo ve. */
export class MenuItemEntity extends BaseEntity {
  key!: string;
  label!: string;
  route!: string;
  group!: string | null;
  icon!: string | null;
  subject!: TSubjects | null;
  requiredAction!: EAbility | null;
  order!: number;
  active!: boolean;
}
