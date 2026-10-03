import type { ForcedSubject, MongoAbility, RawRuleOf } from '@casl/ability';
import type { EAbility } from './ability.enum.js';

// Espejo de ticketkanban/src/app/core/casl/casl.types.ts.
export const SUBJECTS = ['Ticket', 'User', 'RolePermission', 'Relationship', 'Notification', 'AuditLog', 'MenuItem', 'Catalog', 'Metric', 'MyMetric', 'ScheduledJob', 'all'] as const;
export type TSubjects = (typeof SUBJECTS)[number];
export type TAppAbility = MongoAbility<[EAbility, TSubjects | ForcedSubject<TSubjects>]>;
export type TAppRule = RawRuleOf<TAppAbility>;

/**
 * Condición (ABAC) de un permiso por rol — preset con nombre, no JSON libre (mismo criterio que
 * `condition_preset` de wallet-api): el admin elige de una lista cerrada.
 *  - NONE            → sin condición (todo el tipo de recurso)
 *  - OWN             → solo filas donde es titular (`ownerUuid = yo`)
 *  - ASSIGNED_TO_ME  → solo tickets asignados a su correo
 */
export const CONDITION_PRESETS = ['NONE', 'OWN', 'ASSIGNED_TO_ME'] as const;
export type TConditionPreset = (typeof CONDITION_PRESETS)[number];
