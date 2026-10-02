import { EUserRole } from '../app/core/casl/ability.enum';
import type { IEnvironment } from './environment.interface';

/**
 * Usuarios SEMBRADOS de desarrollo (ticketlistbe/src/modules/users/users.seed.ts). No es un
 * secreto: esos usuarios no existen fuera de desarrollo. Archivo propio porque `environment.bff.ts`
 * no puede importar `./environment` (fileReplacements lo reemplaza por él mismo).
 */
export const DEV_SIGN_IN: NonNullable<IEnvironment['devSignIn']> = {
  password: 'ticketit-dev',
  emailByRole: {
    [EUserRole.ADMIN]: 'marta@ticketit.dev',
    [EUserRole.AGENT]: 'ana@ticketit.dev',
    [EUserRole.SUPERVISOR]: 'sergio@ticketit.dev',
    [EUserRole.AUDITOR]: 'aurora@ticketit.dev',
    [EUserRole.VIEWER]: 'victor@ticketit.dev',
  },
};
