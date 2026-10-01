import type { EUserRole } from '../casl/ability.enum.js';

export interface ISessionUser {
  uuid: string;
  name: string;
  email: string;
  role: EUserRole;
  /** Clase de ícono (`pi-star`) elegida en el perfil; `null` = iniciales. Ver `avatar.const.ts`. */
  avatarIcon: string | null;
  /** Color de fondo del avatar (de `AVATAR_COLORS`); `null` = el del tema. */
  avatarColor: string | null;
}
