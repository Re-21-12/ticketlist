import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../../core/session/session.store';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { Illustration } from '../../../shared/ui/illustration/illustration';
import { PASSWORD_FORM } from '../../profile/password-form.config';
import { ProfileService } from '../../profile/profile.service';
import type { TChangePasswordForm } from '../../profile/profile.types';

/**
 * Cambio de contraseña OBLIGATORIO: quien entró con la contraseña temporal que le dio un administrador debe elegir una
 * propia antes de usar el sistema (mientras tanto el backend responde 403 `SAUT-E015` a todo lo demás). Al terminar se
 * vuelve a pedir el shell —ya sin la marca— y se entra al tablero.
 */
@Component({
  selector: 'app-change-password',
  imports: [Illustration, ButtonModule, DynamicForm],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css',
})
export class ChangePassword {
  private readonly _profileService = inject(ProfileService);
  private readonly _sessionStore = inject(SessionStore);
  private readonly _router = inject(Router);
  private readonly _messageService = inject(MessageService);

  protected readonly form = PASSWORD_FORM;
  protected readonly $submitting = signal(false);

  protected async onSubmit(value: TChangePasswordForm): Promise<void> {
    this.$submitting.set(true);
    try {
      await firstValueFrom(this._profileService.changePassword({ currentPassword: value.currentPassword, newPassword: value.newPassword }));
      await this._sessionStore.loadSession();
      this._messageService.add({ severity: 'success', summary: 'Contraseña actualizada', detail: 'Ya puedes usar el sistema.', life: 3500 });
      await this._router.navigateByUrl('/');
    } catch {
      // Contraseña temporal incorrecta o nueva débil: `errorInterceptor` ya avisó y el formulario conserva lo escrito.
    } finally {
      this.$submitting.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this._sessionStore.signOut();
    await this._router.navigateByUrl('/sign-in');
  }
}
