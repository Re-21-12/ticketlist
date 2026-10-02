import type { TBadgeStyle } from '../../shared/dynamic-form/utils/with-badges.util';
import { EUserRole } from './ability.enum';

/** Etiqueta visible de cada rol (cabecera del perfil, selector de rol de prueba, tablas). */
export const ROLE_LABELS: Record<EUserRole, string> = {
  [EUserRole.ADMIN]: 'Administrador',
  [EUserRole.AGENT]: 'Agente',
  [EUserRole.SUPERVISOR]: 'Supervisor',
  [EUserRole.AUDITOR]: 'Auditor',
  [EUserRole.VIEWER]: 'Cliente',
};

/** Ícono y color de cada rol (insignias en las tablas; el texto siempre acompaña). */
export const ROLE_BADGES: Record<string, TBadgeStyle> = {
  [EUserRole.ADMIN]: { icon: 'pi-shield', severity: 'danger' },
  [EUserRole.SUPERVISOR]: { icon: 'pi-sitemap', severity: 'warn' },
  [EUserRole.AGENT]: { icon: 'pi-headphones', severity: 'info' },
  [EUserRole.AUDITOR]: { icon: 'pi-search', severity: 'contrast' },
  [EUserRole.VIEWER]: { icon: 'pi-user', severity: 'secondary' },
};
