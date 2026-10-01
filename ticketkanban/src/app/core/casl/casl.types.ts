import { Ability, type AbilityClass, type ForcedSubject, type MongoAbility } from '@casl/ability';
import type { EAbility } from './ability.enum';

// Espejo de ticketlistbe/src/modules/auth/casl/casl.types.ts.
export const SUBJECTS = ['Ticket', 'User', 'RolePermission', 'Relationship', 'Notification', 'all'] as const;
export type TSubjects = (typeof SUBJECTS)[number];

/** Acción como literal (`'create'`) — permite escribirla en templates sin exponer el enum. */
export type TAbilityAction = `${EAbility}`;

/**
 * Un subject puede ser el tipo (`'Ticket'`) o una instancia marcada con `subject('Ticket', obj)`
 * — esta última es la que evalúa reglas con condiciones (p. ej. «solo tickets asignados a mí»).
 */
export type AppAbility = MongoAbility<[EAbility | TAbilityAction, TSubjects | ForcedSubject<TSubjects>]>;

/**
 * Patrón "Companion object" de la doc oficial de @casl/angular (sección Type safety): `AppAbility`
 * es a la vez el tipo y, en runtime, la clase `Ability`. Así `{ provide: AppAbility }` registra el
 * mismo token `Ability` que inyecta internamente `AbilityServiceSignal`.
 */
export const AppAbility = Ability as AbilityClass<AppAbility>;
