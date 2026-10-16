import { Service, signal } from '@angular/core';
import { map, switchMap, tap, type Observable } from 'rxjs';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { TempCredentialSchema, UserSchema } from './user.schema';
import type { ITempCredentialView, TUser, TUserCreate, TUserForm } from './user.types';

/**
 * Acceso HTTP de `/api/users` (administración). Las cuentas se DESHABILITAN (reversible), nunca se borran. Un
 * administrador también las crea (con una contraseña temporal de un solo uso) y restablece la contraseña o el
 * autenticador de quien lo perdió. Sin correo (no hay SMTP): la credencial temporal se ve UNA vez, en pantalla.
 */
@Service()
export class UsersService extends BaseApiAbstract<TUser, TUserCreate, TUserForm> {
  protected readonly endpoint = '/api/users';
  protected readonly $uuid = signal<string | undefined>(undefined);

  private readonly $_credential = signal<ITempCredentialView | null>(null);
  /** La contraseña temporal recién generada (alta o restablecimiento), a la espera de mostrarse. */
  readonly $credential = this.$_credential.asReadonly();

  protected override parseItem(raw: unknown): TUser {
    return UserSchema.parse(raw);
  }

  /** Alta: devuelve el usuario y deja la credencial temporal en `$credential` para mostrarla. */
  override create(dto: TUserCreate): Observable<TUser> {
    return this._http.post<unknown>(this.endpoint, dto).pipe(
      map((raw) => TempCredentialSchema.parse(raw)),
      tap((credential) => this.$_credential.set({ ...credential, kind: 'created' })),
      map((credential) => credential.user),
    );
  }

  /** Contraseña temporal NUEVA: cierra sus sesiones, quita el bloqueo y le obliga a cambiarla al entrar. */
  resetPassword(uuid: string): Observable<TUser> {
    return this._http.post<unknown>(`${this.endpoint}/${uuid}/reset-password`, null).pipe(
      map((raw) => TempCredentialSchema.parse(raw)),
      tap((credential) => this.$_credential.set({ ...credential, kind: 'reset' })),
      map((credential) => credential.user),
    );
  }

  /** Quita el autenticador de la persona (perdió el teléfono): podrá configurarlo de nuevo. */
  resetTotp(uuid: string): Observable<TUser> {
    return this._http.post<unknown>(`${this.endpoint}/${uuid}/reset-totp`, null).pipe(map((raw) => this.parseItem(raw)));
  }

  clearCredential(): void {
    this.$_credential.set(null);
  }

  /**
   * El formulario edita rol y estado juntos; el backend los expone en dos endpoints (cada uno con su
   * regla: no cambiar el propio rol, no dejar el sistema sin administrador). Se envían en orden y, si
   * el valor no cambió, el backend responde 200 sin tocar nada.
   */
  override update(uuid: string, dto: TUserForm): Observable<TUser> {
    const role$ = this._http.patch<unknown>(`${this.endpoint}/${uuid}/role`, { role: dto.role });
    const status$ = this._http.patch<unknown>(`${this.endpoint}/${uuid}/status`, {
      disabled: dto.disabled,
      // Desbloquear = quitar la marca; si la cuenta no estaba bloqueada, el backend no cambia nada.
      ...(dto.locked ? {} : { locked: false as const }),
    });
    return role$.pipe(
      switchMap(() => status$),
      map((raw) => this.parseItem(raw)),
    );
  }
}
