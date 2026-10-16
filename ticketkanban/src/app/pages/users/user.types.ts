import type { z } from 'zod';
import type { CreateUserFormSchema, TempCredentialSchema, UserFormSchema, UserSchema } from './user.schema';

export type TUser = z.output<typeof UserSchema>;
export type TUserForm = z.output<typeof UserFormSchema>;
export type TUserCreate = z.output<typeof CreateUserFormSchema>;
export type TTempCredential = z.output<typeof TempCredentialSchema>;

/** Lo que el diálogo de «contraseña temporal» muestra: de dónde viene (alta o restablecimiento) y la credencial. */
export interface ITempCredentialView extends TTempCredential {
  kind: 'created' | 'reset';
}
