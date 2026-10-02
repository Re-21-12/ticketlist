import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import {
  AvatarSchema,
  NotificationListSchema,
  NotificationSchema,
  SessionListSchema,
  TotpSetupSchema,
  TotpStatusSchema,
} from './profile.schema';
import type { IChangePasswordRequest, TAvatar, TNotification, TTotpSetup } from './profile.types';

/**
 * Acceso HTTP de «Mi perfil»: SOLO transporte + validación Zod de la respuesta. El estado de pantalla
 * (guardando, qué se muestra) vive en `ProfileStore`. Todo opera sobre el usuario de la sesión: ningún
 * endpoint recibe un `userUuid`.
 */
@Service()
export class ProfileService {
  private readonly _http = inject(HttpClient);

  readonly sessions = httpResource(() => '/api/auth/sessions', {
    parse: (raw) => SessionListSchema.parse(raw),
  });

  readonly notifications = httpResource(() => '/api/notifications', {
    parse: (raw) => NotificationListSchema.parse(raw),
  });

  readonly totp = httpResource(() => '/api/auth/totp', { parse: (raw) => TotpStatusSchema.parse(raw) });

  /** Genera el secreto del autenticador (pendiente hasta confirmarlo con un código). */
  setupTotp(): Observable<TTotpSetup> {
    return this._http.post<unknown>('/api/auth/totp/setup', null).pipe(map((raw) => TotpSetupSchema.parse(raw)));
  }

  enableTotp(code: string): Observable<void> {
    return this._http.post<void>('/api/auth/totp/enable', { code });
  }

  disableTotp(currentPassword: string): Observable<void> {
    return this._http.post<void>('/api/auth/totp/disable', { currentPassword });
  }

  changePassword(dto: IChangePasswordRequest): Observable<void> {
    return this._http.patch<void>('/api/auth/password', dto);
  }

  /** Cierra UNA sesión ajena a la actual. */
  revokeSession(id: string): Observable<void> {
    return this._http.delete<void>(`/api/auth/sessions/${encodeURIComponent(id)}`);
  }

  revokeOtherSessions(): Observable<void> {
    return this._http.post<void>('/api/auth/sessions/revoke-others', null);
  }

  updateAvatar(avatar: TAvatar): Observable<TAvatar> {
    return this._http
      .patch<unknown>('/api/users/me/avatar', avatar)
      .pipe(map((raw) => AvatarSchema.parse(raw)));
  }

  markNotificationRead(uuid: string): Observable<TNotification> {
    return this._http
      .patch<unknown>(`/api/notifications/${encodeURIComponent(uuid)}/read`, null)
      .pipe(map((raw) => NotificationSchema.parse(raw)));
  }
}
