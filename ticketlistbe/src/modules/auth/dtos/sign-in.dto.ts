import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';

export const SignInSchema = z.strictObject({
  email: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La contraseña', min: 8 }) })
    .max(128, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La contraseña', max: 128 }) }),
});

export class SignInDto extends createZodDto(SignInSchema) {}
