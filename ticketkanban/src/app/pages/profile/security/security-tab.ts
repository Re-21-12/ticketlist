import { Component, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { FormSplit } from '../../../layouts/form-split/form-split';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { PASSWORD_FORM } from '../password-form.config';
import { ProfileStore } from '../profile.store';
import type { TChangePasswordForm } from '../profile.types';

/**
 * Pestaña «Seguridad»: cambiar la contraseña. Éxito → toast + el formulario se vacía (se recrea) y las
 * demás sesiones quedan cerradas (lo hace el backend). Error → el toast lo pone `errorInterceptor` y los
 * campos conservan lo escrito, salvo la contraseña actual si era la equivocada (se reescribe de todos modos).
 */
@Component({
  selector: 'app-security-tab',
  imports: [FormSplit, DynamicForm],
  templateUrl: './security-tab.html',
  styleUrl: './security-tab.css',
})
export class SecurityTab {
  protected readonly _profileStore = inject(ProfileStore);
  private readonly _messageService = inject(MessageService);

  protected readonly form = PASSWORD_FORM;
  /** Cambiar la clave recrea el formulario: es la forma de vaciarlo (y su estado de «tocado»). */
  protected readonly $formKey = signal(0);

  protected async onSubmit(value: TChangePasswordForm): Promise<void> {
    try {
      await this._profileStore.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      });
      this.$formKey.update((key) => key + 1);
      this._messageService.add({
        severity: 'success',
        summary: 'Contraseña actualizada',
        detail: 'Cerramos tus otras sesiones por seguridad.',
      });
    } catch {
      // Sin acción: `errorInterceptor` ya avisó y el formulario queda para reintentar.
    }
  }
}
