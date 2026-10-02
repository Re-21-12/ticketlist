import { Service, signal } from '@angular/core';
import { map, switchMap, type Observable } from 'rxjs';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { UserSchema } from './user.schema';
import type { TUser, TUserForm } from './user.types';

/**
 * Acceso HTTP de `/api/users` (administración). No hay alta ni baja desde aquí: las cuentas nacen
 * del registro público y se DESHABILITAN (reversible), nunca se borran.
 */
@Service()
export class UsersService extends BaseApiAbstract<TUser, never, TUserForm> {
  protected readonly endpoint = '/api/users';
  protected readonly $uuid = signal<string | undefined>(undefined);

  protected override parseItem(raw: unknown): TUser {
    return UserSchema.parse(raw);
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
