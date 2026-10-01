import { EUserRole } from './ability.enum';

/** Etiqueta visible de cada rol (cabecera del perfil, selector de rol de prueba, tablas). */
export const ROLE_LABELS: Record<EUserRole, string> = {
  [EUserRole.ADMIN]: 'Administrador',
  [EUserRole.AGENT]: 'Agente',
  [EUserRole.VIEWER]: 'Solo lectura',
};
