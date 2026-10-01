import { computed, inject, Pipe, type PipeTransform, type Signal } from '@angular/core';
import { subject as asSubject } from '@casl/ability';
import { AbilityServiceSignal } from '@casl/angular';
import type { AppAbility, TAbilityAction, TSubjects } from './casl.types';

/**
 * Permisos en templates con signals, sin el pipe `able` de @casl/angular.
 *
 * Por qué no `able`: el README de @casl/angular 10 lo marca como deprecated y es un pipe
 * IMPURO (`pure: false`): se re-ejecuta en cada detección de cambios de la vista, por cada uso.
 *
 * Cómo funciona este: es PURO (Angular solo vuelve a llamar `transform` cuando cambian los
 * argumentos) y devuelve un `Signal<boolean>`. El `computed` lee `AbilityServiceSignal.can()`,
 * que internamente lee el signal `_rules` que CASL actualiza en `ability.update()` — así que al
 * cambiar las reglas (login, cambio de rol) el signal se recalcula y la vista se refresca sola,
 * aunque el pipe no se re-ejecute. Un pipe puro que devolviera `boolean` quedaría congelado con
 * las reglas viejas.
 *
 * ```html
 * @if (('create' | can: 'Ticket')()) { <button>Nuevo ticket</button> }
 * <button [disabled]="!('update' | can: 'Ticket' : ticket)()">Editar</button>
 * ```
 *
 * En TypeScript no hace falta el pipe: `computed(() => this._abilityService.can('create', 'Ticket'))`.
 */
@Pipe({ name: 'can' })
export class CanPipe implements PipeTransform {
  private readonly _abilityService = inject<AbilityServiceSignal<AppAbility>>(AbilityServiceSignal);

  /**
   * @param action   acción CASL (`'read'`, `'update'`…).
   * @param subject  tipo de subject (`'Ticket'`).
   * @param instance registro concreto, para reglas con condiciones (p. ej. `assigneeEmail`).
   */
  transform(action: TAbilityAction, subject: TSubjects, instance?: object | null): Signal<boolean> {
    // Copia: `subject()` de CASL marca el objeto con `__caslSubjectType__` y no queremos mutar
    // registros que vienen de un signal/store.
    const target = instance ? asSubject(subject, { ...instance }) : subject;
    return computed(() => this._abilityService.can(action, target));
  }
}
