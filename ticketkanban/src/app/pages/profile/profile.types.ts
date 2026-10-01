import type { z } from 'zod';
import type {
  AvatarSchema,
  ChangePasswordFormSchema,
  NotificationListSchema,
  NotificationSchema,
  SessionInfoSchema,
  SessionListSchema,
} from './profile.schema';

export type TSessionInfo = z.output<typeof SessionInfoSchema>;
export type TSessionList = z.output<typeof SessionListSchema>;
export type TNotification = z.output<typeof NotificationSchema>;
export type TNotificationList = z.output<typeof NotificationListSchema>;
export type TChangePasswordForm = z.output<typeof ChangePasswordFormSchema>;
export type TAvatar = z.output<typeof AvatarSchema>;

/** Body de `PATCH /api/auth/password` (sin `confirmPassword`). */
export interface IChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Ciclo de vida de «cambiar contraseña» (FSM de `ProfileStore`). */
export type TPasswordState = 'idle' | 'saving' | 'saved' | 'failed';
export type TPasswordEvent = 'SUBMIT' | 'SUCCEED' | 'FAIL';

/** Pestañas de «Mi perfil»: la clave viaja en `?tab=` para poder enlazar a una. */
export type TProfileTab = 'info' | 'security' | 'sessions' | 'notifications' | 'avatar' | 'appearance';
