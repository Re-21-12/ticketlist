import { computed, inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { SessionStore } from '../../core/session/session.store';
import { createStateMachine } from '../../shared/fsm/create-state-machine';
import { ProfileService } from './profile.service';
import type {
  IChangePasswordRequest,
  TAvatar,
  TNotificationList,
  TPasswordEvent,
  TPasswordState,
  TSessionList,
} from './profile.types';

/**
 * Estado de «Mi perfil». Orquesta `ProfileService` (HTTP) y expone a los componentes SOLO lecturas +
 * acciones. Las acciones re-lanzan el error: el toast ya lo muestra `errorInterceptor` y cada pestaña
 * decide la UI (p. ej. dejar el formulario abierto).
 *
 * Cambiar la contraseña es una FSM, no un `signal(boolean)`: un segundo envío mientras `saving` no es
 * una transición válida, así que el doble clic queda bloqueado por construcción.
 *   idle ─SUBMIT→ saving ─SUCCEED→ saved ─SUBMIT→ saving …
 *                       └─FAIL──→ failed ─SUBMIT→ saving …
 */
@Service()
export class ProfileStore {
  private readonly _profileService = inject(ProfileService);
  private readonly _sessionStore = inject(SessionStore);

  private readonly _passwordMachine = createStateMachine<TPasswordState, TPasswordEvent>({
    initial: 'idle',
    states: ['idle', 'saving', 'saved', 'failed'],
    transitions: {
      idle: { SUBMIT: 'saving' },
      saving: { SUCCEED: 'saved', FAIL: 'failed' },
      saved: { SUBMIT: 'saving' },
      failed: { SUBMIT: 'saving' },
    },
  });
  readonly $passwordState = this._passwordMachine.$state;
  readonly $changingPassword = computed(() => this._passwordMachine.is('saving'));

  readonly $sessionsState = computed<TAsyncState<TSessionList>>(() => {
    const sessions = this._profileService.sessions;
    return mapResourceState(sessions.status(), sessions.value(), sessions.error());
  });

  readonly $notificationsState = computed<TAsyncState<TNotificationList>>(() => {
    const notifications = this._profileService.notifications;
    return mapResourceState(notifications.status(), notifications.value(), notifications.error());
  });
  readonly $unreadNotifications = computed(() => {
    const state = this.$notificationsState();
    return state.kind === 'success' ? state.data.unread : 0;
  });

  reloadSessions(): void {
    this._profileService.sessions.reload();
  }

  reloadNotifications(): void {
    this._profileService.notifications.reload();
  }

  /** Cambia la contraseña; el backend cierra las DEMÁS sesiones, así que se refresca la lista. */
  async changePassword(dto: IChangePasswordRequest): Promise<void> {
    if (!this._passwordMachine.send('SUBMIT')) throw new Error('Ya hay un cambio en curso');
    try {
      await firstValueFrom(this._profileService.changePassword(dto));
      this._passwordMachine.send('SUCCEED');
      this.reloadSessions();
    } catch (error) {
      this._passwordMachine.send('FAIL');
      throw error;
    }
  }

  async revokeSession(id: string): Promise<void> {
    await firstValueFrom(this._profileService.revokeSession(id));
    this.reloadSessions();
  }

  async revokeOtherSessions(): Promise<void> {
    await firstValueFrom(this._profileService.revokeOtherSessions());
    this.reloadSessions();
  }

  /** Guarda el avatar y lo refleja en la sesión (topbar, cabecera) sin pedir el shell de nuevo. */
  async updateAvatar(avatar: TAvatar): Promise<void> {
    const saved = await firstValueFrom(this._profileService.updateAvatar(avatar));
    this._sessionStore.patchUser(saved);
  }

  async markNotificationRead(uuid: string): Promise<void> {
    await firstValueFrom(this._profileService.markNotificationRead(uuid));
    this.reloadNotifications();
  }
}
