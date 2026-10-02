import * as z from 'zod';
import { EUserRole } from '../../core/casl/ability.enum';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';

/**
 * CONTRATO de la administración de usuarios. Espejo de ticketlistbe/src/modules/users/dtos/admin-user.dto.ts.
 * Solo el rol y el estado se editan: nombre y correo los muestra el formulario en solo lectura.
 */
export const UserFormSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.enum(EUserRole, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un rol' }) }),
  disabled: z.boolean(),
  /** Solo se puede dejar en `false` (desbloquear); bloquear ocurre por intentos fallidos. */
  locked: z.boolean(),
});

export const UserSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(EUserRole),
  avatarIcon: z.string().nullable(),
  avatarColor: z.string().nullable(),
  emailVerified: z.boolean(),
  disabled: z.boolean(),
  /** Bloqueada por intentos fallidos de inicio de sesión: solo un administrador la desbloquea. */
  locked: z.boolean(),
  lockedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
