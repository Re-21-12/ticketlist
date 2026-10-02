import * as z from 'zod';
import {
  VALIDATION_ERRORS as V,
  validationMessage as msg,
} from '../../core/validation/validation-errors';
import { AVATAR_COLORS, AVATAR_ICONS } from '../../core/ui/user-avatar/avatar.const';
import {
  ConfirmPasswordSchema,
  passwordsMatch,
  StrongPasswordSchema,
} from '../../core/validation/password.schema';

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

/** Autenticador (TOTP): espejo de `TotpStatusSchema` / `TotpSetupSchema` del backend. */
export const TotpStatusSchema = z.object({ enabled: z.boolean() });
export const TotpSetupSchema = z.object({ secret: z.string(), otpauthUrl: z.string() });
export const TotpEnableFormSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: msg(V.ACCOUNT.CODE_INVALID) }),
});
export const TotpDisableFormSchema = z.object({
  currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
});

export const NOTIFICATION_TYPES = [
  'TICKET_ASSIGNED',
  'TICKET_CHANGED_BY_ALTERNANTE',
  'RELATIONSHIP_GRANTED',
  'RELATIONSHIP_REVOKED',
  'TICKET_STATUS_CHANGED',
  'TICKET_COMMENTED',
  'TICKET_REOPENED',
  'TICKET_SURVEY',
  'TICKET_SURVEY_ALERT',
  'ACCOUNT_LOCKED',
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

/**
 * Formulario «Cambiar contraseña». Las reglas de `newPassword` son las compartidas con el registro y
 * el restablecer (`core/validation/password.schema.ts`, espejo del backend); `confirmPassword` solo
 * existe aquí: nunca viaja (el backend usa `strictObject`).
 */
export const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, { error: msg(V.PASSWORD.CURRENT_REQUIRED) }).max(128),
    newPassword: StrongPasswordSchema,
    confirmPassword: ConfirmPasswordSchema,
  })
  .refine(...passwordsMatch('newPassword', 'confirmPassword'));

/** Respuesta de `PATCH /api/users/me/avatar` y body (mismo shape). */
export const AvatarSchema = z.object({
  avatarIcon: z.enum(AVATAR_ICONS).nullable(),
  avatarColor: z.enum(AVATAR_COLORS).nullable(),
});
