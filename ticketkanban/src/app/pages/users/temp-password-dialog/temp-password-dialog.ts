import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DynamicDialogConfig, DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import type { ITempCredentialView } from '../user.types';

/**
 * Muestra UNA vez la contraseña temporal de una cuenta recién creada o restablecida. No hay correo (sin SMTP): la
 * administración se la entrega a la persona en persona. Solo se cierra tras confirmar que se entregó; después ya no se
 * puede volver a ver (el backend solo guarda su hash): si se pierde, se restablece otra.
 */
@Component({
  selector: 'app-temp-password-dialog',
  imports: [ButtonModule, DatePipe],
  templateUrl: './temp-password-dialog.html',
  styleUrl: './temp-password-dialog.css',
})
export class TempPasswordDialog {
  private readonly _ref = inject(DynamicDialogRef);
  private readonly _messageService = inject(MessageService);
  protected readonly credential = inject<DynamicDialogConfig<ITempCredentialView>>(DynamicDialogConfig).data as ITempCredentialView;

  protected readonly $delivered = signal(false);

  protected setDelivered(event: Event): void {
    this.$delivered.set((event.target as HTMLInputElement).checked);
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.credential.tempPassword);
      this._messageService.add({ severity: 'success', summary: 'Contraseña copiada', life: 2500 });
      this.$delivered.set(true);
    } catch {
      this._messageService.add({ severity: 'warn', summary: 'No se pudo copiar', detail: 'Selecciónala y cópiala a mano.' });
    }
  }

  protected close(): void {
    if (this.$delivered()) this._ref.close();
  }
}
