import type { TBadgeStyle } from '../../shared/dynamic-form/utils/with-badges.util';
import type { AUDIT_ACTIONS, AUDIT_OUTCOMES } from './audit-log.schema';

export const AUDIT_ACTION_LABELS: Record<(typeof AUDIT_ACTIONS)[number], string> = {
  CREATE: 'Crear',
  UPDATE: 'Editar',
  DELETE: 'Eliminar',
  SIGN_IN: 'Inicio de sesión',
  SIGN_OUT: 'Cierre de sesión',
};

export const AUDIT_OUTCOME_LABELS: Record<(typeof AUDIT_OUTCOMES)[number], string> = {
  SUCCESS: 'Correcto',
  DENIED: 'Denegado',
  FAILED: 'Fallido',
};

/** Ícono y color de la acción y del resultado en la tabla de auditoría (el texto siempre acompaña). */
export const AUDIT_ACTION_BADGES: Record<string, TBadgeStyle> = {
  CREATE: { icon: 'pi-plus-circle', severity: 'success' },
  UPDATE: { icon: 'pi-pencil', severity: 'info' },
  DELETE: { icon: 'pi-trash', severity: 'danger' },
  SIGN_IN: { icon: 'pi-sign-in', severity: 'secondary' },
  SIGN_OUT: { icon: 'pi-sign-out', severity: 'secondary' },
};
export const AUDIT_OUTCOME_BADGES: Record<string, TBadgeStyle> = {
  SUCCESS: { icon: 'pi-check-circle', severity: 'success' },
  DENIED: { icon: 'pi-lock', severity: 'warn' },
  FAILED: { icon: 'pi-times-circle', severity: 'danger' },
};
