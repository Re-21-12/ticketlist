import * as z from 'zod';
import {
  VALIDATION_ERRORS as V,
  validationMessage as msg,
} from '../../core/validation/validation-errors';
import { AVATAR_COLORS, AVATAR_ICONS } from '../../core/ui/user-avatar/avatar.const';

/** Una sesión activa. `id` es un hash opaco (nunca el `sid` de la cookie). Espejo de `SessionInfoSchema`. */
export const SessionInfoSchema = z.object({
  id: z.string(),
  current: z.boolean(),
  ipAddress: z.string(),
  userAgent: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
});
export const SessionListSchema = z.object({ data: z.array(SessionInfoSchema) });

export const NOTIFICATION_TYPES = [
  'TICKET_ASSIGNED',
  'TICKET_CHANGED_BY_ALTERNANTE',
  'RELATIONSHIP_GRANTED',
  'RELATIONSHIP_REVOKED',
] as const;

/** Espejo de `NotificationListSchema` del backend. */
export const NotificationSchema = z.object({
  uuid: z.uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  message: z.string(),
  resourceType: z.enum(['Ticket', 'Relationship']).nullable(),
  resourceUuid: z.uuid().nullable(),
  readAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export const NotificationListSchema = z.object({
  data: z.array(NotificationSchema),
  unread: z.number().int(),
});

/** Reglas de complejidad — MISMO orden y textos que `StrongPasswordSchema` del backend. */
const COMPLEXITY_RULES: readonly (readonly [label: string, test: RegExp])[] = [
  ['mayúscula', /[A-ZÁÉÍÓÚÜÑ]/],
  ['minúscula', /[a-záéíóúüñ]/],
  ['número', /\d/],
  ['símbolo (!@#$%)', /[^A-Za-záéíóúüñÁÉÍÓÚÜÑ0-9]/],
];

/**
 * Formulario «Cambiar contraseña». Las reglas de `newPassword` son las del backend (el BFF vuelve a
 * validar); `confirmPassword` solo existe aquí: nunca viaja (el backend usa `strictObject`).
 */
export const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
    newPassword: z
      .string()
      .min(8, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La contraseña', min: 8 }) })
      .max(128, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La contraseña', max: 128 }) })
      .superRefine((value, ctx) => {
        const missing = COMPLEXITY_RULES.filter(([, test]) => !test.test(value)).map(([label]) => label);
        if (missing.length) {
          ctx.addIssue({ code: 'custom', message: msg(V.PASSWORD.MISSING, { missing: missing.join(', ') }) });
        }
      }),
    confirmPassword: z.string().min(1, { error: 'Repite la contraseña nueva' }),
  })
  .refine((form) => form.newPassword === form.confirmPassword, {
    error: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
    // Que corra aunque `newPassword` siga inválida: si no, el error de confirmación aparece tarde.
    when: (payload) =>
      typeof (payload.value as { newPassword?: unknown }).newPassword === 'string' &&
      typeof (payload.value as { confirmPassword?: unknown }).confirmPassword === 'string',
  });

/** Respuesta de `PATCH /api/users/me/avatar` y body (mismo shape). */
export const AvatarSchema = z.object({
  avatarIcon: z.enum(AVATAR_ICONS).nullable(),
  avatarColor: z.enum(AVATAR_COLORS).nullable(),
});
