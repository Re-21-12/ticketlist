import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { StrongPasswordSchema } from './change-password.dto.js';

const EmailSchema = z
  .email({ error: msg(V.GENERIC.IS_EMAIL) })
  .max(254)
  .transform((email) => email.toLowerCase());

/** Token de un enlace de correo: 32 bytes en base64url = 43 caracteres. Se acota para no procesar basura. */
const TokenSchema = z
  .string({ error: msg(V.ACCOUNT.TOKEN_REQUIRED) })
  .regex(/^[A-Za-z0-9_-]{20,128}$/, { error: msg(V.ACCOUNT.TOKEN_REQUIRED) });

export const SignUpSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(3, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El nombre', min: 3 }) })
    .max(120, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El nombre', max: 120 }) }),
  email: EmailSchema,
  password: StrongPasswordSchema,
});
export class SignUpDto extends createZodDto(SignUpSchema) {}

export const EmailOnlySchema = z.strictObject({ email: EmailSchema });
export class EmailOnlyDto extends createZodDto(EmailOnlySchema) {}

export const VerifyEmailSchema = z.strictObject({ token: TokenSchema });
export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}

export const ResetPasswordSchema = z.strictObject({ token: TokenSchema, newPassword: StrongPasswordSchema });
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}

/** Código de 6 dígitos de la app autenticadora. */
export const TotpCodeSchema = z.string({ error: msg(V.ACCOUNT.CODE_INVALID) }).regex(/^\d{6}$/, { error: msg(V.ACCOUNT.CODE_INVALID) });

/**
 * Recuperar con un SEGUNDO FACTOR en vez del enlace del correo: el código del autenticador (TOTP) o la
 * contraseña actual. En ambos la persona elige la contraseña nueva (el sistema nunca fabrica una).
 */
export const RecoverPasswordSchema = z.discriminatedUnion('method', [
  z.strictObject({ method: z.literal('totp'), email: EmailSchema, code: TotpCodeSchema, newPassword: StrongPasswordSchema }),
  z.strictObject({
    method: z.literal('current_password'),
    email: EmailSchema,
    currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
    newPassword: StrongPasswordSchema,
  }),
]);
/**
 * Una clase no puede extender un tipo unión: el DTO se declara con la forma «plana» del cuerpo y el schema
 * (la unión discriminada por `method`) sigue siendo la fuente de validación.
 */
interface IRecoverPasswordBody {
  method: 'totp' | 'current_password';
  email: string;
  newPassword: string;
  code?: string;
  currentPassword?: string;
}
const RecoverPasswordBase = createZodDto(RecoverPasswordSchema) as unknown as {
  new (): IRecoverPasswordBody;
  readonly schema: typeof RecoverPasswordSchema;
  readonly isZodDto: true;
};
export class RecoverPasswordDto extends RecoverPasswordBase {}

export const TotpEnableSchema = z.strictObject({ code: TotpCodeSchema });
export class TotpEnableDto extends createZodDto(TotpEnableSchema) {}

export const TotpDisableSchema = z.strictObject({
  currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
});
export class TotpDisableDto extends createZodDto(TotpDisableSchema) {}

/** Alta del autenticador: el secreto (para escribirlo a mano) y la URL `otpauth://` (para el QR). Se muestra UNA vez. */
export const TotpSetupSchema = z.object({ secret: z.string(), otpauthUrl: z.string() });
export const TotpStatusSchema = z.object({ enabled: z.boolean() });

/** Respuesta genérica (anti-enumeración): igual exista o no la cuenta. `devUrl` solo fuera de producción. */
export const AccountMessageSchema = z.object({
  message: z.string(),
  devUrl: z.string().optional(),
});
export type TAccountMessage = z.output<typeof AccountMessageSchema>;
