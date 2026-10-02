import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from './validation-errors';

/** Reglas de complejidad — MISMO orden y textos que `StrongPasswordSchema` del backend. */
const COMPLEXITY_RULES: readonly (readonly [label: string, test: RegExp])[] = [
  ['mayúscula', /[A-ZÁÉÍÓÚÜÑ]/],
  ['minúscula', /[a-záéíóúüñ]/],
  ['número', /\d/],
  ['símbolo (!@#$%)', /[^A-Za-záéíóúüñÁÉÍÓÚÜÑ0-9]/],
];

/**
 * Contraseña NUEVA: 8–128 caracteres + las cuatro clases; el mensaje dice QUÉ falta («Agrega:
 * mayúscula, número»), no «inválida». Espejo de `StrongPasswordSchema`
 * (ticketlistbe/src/modules/auth/dtos/change-password.dto.ts): el BFF vuelve a validar.
 */
export const StrongPasswordSchema = z
  .string()
  .min(8, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La contraseña', min: 8 }) })
  .max(128, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La contraseña', max: 128 }) })
  .superRefine((value, ctx) => {
    const missing = COMPLEXITY_RULES.filter(([, test]) => !test.test(value)).map(([label]) => label);
    if (missing.length) {
      ctx.addIssue({ code: 'custom', message: msg(V.PASSWORD.MISSING, { missing: missing.join(', ') }) });
    }
  });

/** Campo «repite la contraseña» (solo existe en el formulario; nunca viaja al backend). */
export const ConfirmPasswordSchema = z.string().min(1, { error: 'Repite la contraseña nueva' });

/**
 * Regla cross-field «confirmación = contraseña». `when` la hace correr aunque la contraseña siga
 * inválida (por defecto Zod salta los refinements del objeto si algún campo falló): el error de
 * confirmación aparece al instante, no después de arreglar la complejidad.
 */
export function passwordsMatch(
  passwordKey: string,
  confirmKey: string,
): [
  check: (form: Record<string, unknown>) => boolean,
  params: { error: string; path: string[]; when: (payload: { value: unknown }) => boolean },
] {
  const read = (value: unknown, key: string): unknown => (value as Record<string, unknown>)[key];
  return [
    (form) => read(form, passwordKey) === read(form, confirmKey),
    {
      error: 'Las contraseñas no coinciden',
      path: [confirmKey],
      when: (payload) =>
        typeof read(payload.value, passwordKey) === 'string' && typeof read(payload.value, confirmKey) === 'string',
    },
  ];
}
