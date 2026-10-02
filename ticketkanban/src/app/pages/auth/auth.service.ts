import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { suppressErrorToast } from '../../core/interceptors/suppress-error-toast.token';
import { AccountMessageSchema } from './auth.schema';
import type { TAccountMessage } from './auth.types';

/**
 * Acceso HTTP del alta de cuenta y la recuperación (endpoints PÚBLICOS: no hay sesión todavía). Solo
 * transporte + validación Zod de la respuesta; el iniciar sesión vive en `SessionService`.
 *
 * Los errores que la pantalla muestra EN LÍNEA (enlace vencido, correo sin verificar) viajan con
 * `suppressErrorToast()` para no mostrarse dos veces (toast + mensaje en la página).
 */
@Service()
export class AuthService {
  private readonly _http = inject(HttpClient);

  signUp(dto: { name: string; email: string; password: string }): Observable<TAccountMessage> {
    return this._http.post<unknown>('/api/auth/sign-up', dto).pipe(map((raw) => AccountMessageSchema.parse(raw)));
  }

  /** 204 si el enlace sirvió; 400 `SAUT-E009` si venció o ya se usó (la página lo explica). */
  verifyEmail(token: string): Observable<void> {
    return this._http.post<void>('/api/auth/verify-email', { token }, { context: suppressErrorToast() });
  }

  resendVerification(email: string): Observable<TAccountMessage> {
    return this._http
      .post<unknown>('/api/auth/resend-verification', { email })
      .pipe(map((raw) => AccountMessageSchema.parse(raw)));
  }

  forgotPassword(email: string): Observable<TAccountMessage> {
    return this._http
      .post<unknown>('/api/auth/forgot-password', { email })
      .pipe(map((raw) => AccountMessageSchema.parse(raw)));
  }

  /**
   * Restablece con un SEGUNDO FACTOR en lugar del enlace del correo (código del autenticador o contraseña
   * actual). 401 `SAUT-E010` es la misma respuesta para cualquier fallo: la pantalla la explica en línea.
   */
  recoverPassword(
    dto:
      | { method: 'totp'; email: string; code: string; newPassword: string }
      | { method: 'current_password'; email: string; currentPassword: string; newPassword: string },
  ): Observable<void> {
    return this._http.post<void>('/api/auth/recover-password', dto, { context: suppressErrorToast() });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this._http.post<void>('/api/auth/reset-password', { token, newPassword });
  }
}
