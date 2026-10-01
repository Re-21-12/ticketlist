import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';

/** Reglas de complejidad (las ve el usuario en orden: mayúscula, minúscula, número, símbolo). */
const RULES: readonly [label: string, test: RegExp][] = [
  ['mayúscula', /[A-ZÁÉÍÓÚÜÑ]/],
  ['minúscula', /[a-záéíóúüñ]/],
  ['número', /\d/],
  ['símbolo (!@#$%)', /[^A-Za-záéíóúüñÁÉÍÓÚÜÑ0-9]/],
];

/** Contraseña nueva: 8–128 caracteres + las cuatro clases; el mensaje dice QUÉ falta, no «inválida». */
export const StrongPasswordSchema = z
  .string()
  .min(8, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La contraseña', min: 8 }) })
  .max(128, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La contraseña', max: 128 }) })
  .superRefine((value, ctx) => {
    const missing = RULES.filter(([, test]) => !test.test(value)).map(([label]) => label);
    if (missing.length) {
      ctx.addIssue({ code: 'custom', message: msg(V.PASSWORD.MISSING, { missing: missing.join(', ') }) });
    }
  });

export const ChangePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
  newPassword: StrongPasswordSchema,
});

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
