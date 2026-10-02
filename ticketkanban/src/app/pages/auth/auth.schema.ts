import * as z from 'zod';
import { ConfirmPasswordSchema, passwordsMatch, StrongPasswordSchema } from '../../core/validation/password.schema';
import {
  VALIDATION_ERRORS as V,
  validationMessage as msg,
} from '../../core/validation/validation-errors';

const EmailSchema = z.email({ error: msg(V.GENERIC.IS_EMAIL) }).max(254);

/**
 * Iniciar sesión: NO se aplica la regla de complejidad a la contraseña ACTUAL (una cuenta antigua
 * podría no cumplirla y quedaría fuera): solo que no esté vacía. El backend decide si es correcta.
 */
export const SignInFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { error: 'Ingresa tu contraseña' }).max(128),
});

export const SignUpFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El nombre', min: 3 }) })
      .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El nombre', max: 120 }) }),
    email: EmailSchema,
    password: StrongPasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(...passwordsMatch('password', 'confirmPassword'));

export const ForgotPasswordFormSchema = z.object({ email: EmailSchema });

export const ResetPasswordFormSchema = z
  .object({
    newPassword: StrongPasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword', 'confirmPassword'));

/** Código de 6 dígitos de la app autenticadora (TOTP). */
export const TotpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, { error: msg(V.ACCOUNT.CODE_INVALID) });

/** «Recuperar con el autenticador»: correo + código de 6 dígitos + contraseña nueva. */
export const RecoverWithTotpFormSchema = z
  .object({
    email: EmailSchema,
    code: TotpCodeSchema,
    newPassword: StrongPasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword', 'confirmPassword'));

/** «Recuperar con la contraseña actual»: no se aplica la regla de complejidad a la ACTUAL (puede ser antigua). */
export const RecoverWithPasswordFormSchema = z
  .object({
    email: EmailSchema,
    currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
    newPassword: StrongPasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword', 'confirmPassword'));

/** Formas de recuperar el acceso (mismo orden en que se ofrecen). */
export const RECOVERY_METHODS = ['email', 'totp', 'current_password'] as const;

/** Respuesta genérica de sign-up / forgot / resend. `devUrl` (enlace del correo) solo fuera de producción. */
export const AccountMessageSchema = z.object({
  message: z.string(),
  devUrl: z.string().optional(),
});
