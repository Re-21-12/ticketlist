import { SetMetadata } from '@nestjs/common';
import type { EAbility } from './ability.enum.js';
import type { TSubjects } from './casl.types.js';

export const CHECK_ABILITY_KEY = 'checkAbility';

export interface ICheckAbility {
  action: EAbility;
  subject: TSubjects;
}

/** Permiso a nivel de TIPO para el endpoint; el nivel de REGISTRO (condiciones) lo valida el servicio. */
export const CheckAbility = (action: EAbility, subject: TSubjects) =>
  SetMetadata(CHECK_ABILITY_KEY, { action, subject } satisfies ICheckAbility);
