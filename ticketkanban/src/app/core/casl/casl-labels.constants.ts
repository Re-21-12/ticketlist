import { EAbility } from './ability.enum';
import type { TSubjects } from './casl.types';

/** Etiqueta visible de cada recurso CASL (pantallas de permisos, menú y auditoría). */
export const SUBJECT_LABELS: Record<TSubjects, string> = {
  Ticket: 'Tickets',
  User: 'Usuarios',
  RolePermission: 'Permisos por rol',
  Relationship: 'Relaciones (compartir)',
  Notification: 'Notificaciones',
  AuditLog: 'Auditoría',
  MenuItem: 'Menú',
  Catalog: 'Catálogos',
  Metric: 'Métricas del equipo',
  MyMetric: 'Mis métricas',
  all: 'Todo el sistema',
};

export const ACTION_LABELS: Record<EAbility, string> = {
  [EAbility.MANAGE]: 'Administrar (todo)',
  [EAbility.CREATE]: 'Crear',
  [EAbility.READ]: 'Leer',
  [EAbility.UPDATE]: 'Editar',
  [EAbility.DELETE]: 'Eliminar',
  [EAbility.RESTORE]: 'Restaurar',
};

/** Presets ABAC de un permiso por rol (espejo de `CONDITION_PRESETS` del backend; lista cerrada, no JSON libre). */
export const CONDITION_PRESETS = ['NONE', 'OWN', 'ASSIGNED_TO_ME'] as const;
export type TConditionPreset = (typeof CONDITION_PRESETS)[number];

export const CONDITION_LABELS: Record<TConditionPreset, string> = {
  NONE: 'Sin condición (todo el recurso)',
  OWN: 'Solo lo propio (titular)',
  ASSIGNED_TO_ME: 'Solo lo asignado a mí',
};
