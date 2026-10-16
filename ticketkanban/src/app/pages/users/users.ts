import { Component, computed, effect, inject, untracked } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';
import { SessionStore } from '../../core/session/session.store';
import { CrudPage } from '../../shared/crud-page/crud-page';
import type { ICrudConfig } from '../../shared/crud-page/crud-page.interface';
import type { TTableRow } from '../../shared/dynamic-table/dynamic-table.interface';
import { USER_CRUD } from './user-form.config';
import { UsersService } from './users.service';

/**
 * «Usuarios»: ver cuentas, crearlas (con una contraseña temporal de un solo uso), cambiar el rol, deshabilitar o
 * desbloquear, y restablecer la contraseña o el autenticador de quien lo perdió. Sin correo: la credencial temporal se
 * muestra una vez en un diálogo y la administración se la entrega a la persona.
 */
@Component({
  selector: 'app-users',
  imports: [CrudPage],
  providers: [DialogService],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  protected readonly _service = inject(UsersService);
  private readonly _session = inject(SessionStore);
  private readonly _dialogService = inject(DialogService);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _messageService = inject(MessageService);
  private _dialogOpen = false;

  /** Las acciones de seguridad no aplican a la propia cuenta (para eso está «Mi perfil»). */
  protected readonly $config = computed<ICrudConfig>(() => {
    const notMe = (row: TTableRow): boolean => row['email'] !== this._session.$user()?.email;
    return {
      ...USER_CRUD,
      table: {
        ...USER_CRUD.table,
        rowActions: [
          { id: 'reset-password', label: 'Clave temporal', icon: 'pi-key', severity: 'warn', visible: notMe },
          { id: 'reset-totp', label: 'Quitar TOTP', icon: 'pi-mobile', severity: 'warn', visible: (row) => notMe(row) && row['totpEnabled'] === true },
        ],
      },
      onRowAction: (id, row) => this.onRowAction(id, row),
    };
  });

  constructor() {
    // Una credencial temporal nueva (alta o restablecimiento) se muestra en el diálogo, una sola vez.
    effect(() => {
      if (this._service.$credential()) untracked(() => void this.showCredential());
    });
  }

  private onRowAction(id: string, row: TTableRow): void {
    const name = String(row['name'] ?? row['email'] ?? '');
    const uuid = String(row['uuid']);
    if (id === 'reset-password') {
      this._confirmationService.confirm({
        header: 'Restablecer contraseña',
        message: `Se generará una contraseña temporal para ${name}, se cerrarán sus sesiones y deberá cambiarla al entrar. ¿Continuar?`,
        acceptButtonProps: { label: 'Generar contraseña temporal' },
        rejectButtonProps: { severity: 'secondary', outlined: true, label: 'Cancelar' },
        defaultFocus: 'reject',
        accept: () => void this.run(() => firstValueFrom(this._service.resetPassword(uuid))),
      });
    } else if (id === 'reset-totp') {
      this._confirmationService.confirm({
        header: 'Quitar autenticador',
        message: `${name} dejará de usar su app autenticadora y sus códigos de recuperación, y podrá configurarla de nuevo. ¿Continuar?`,
        acceptButtonProps: { label: 'Quitar autenticador', severity: 'danger' },
        rejectButtonProps: { severity: 'secondary', outlined: true, label: 'Cancelar' },
        defaultFocus: 'reject',
        accept: () =>
          void this.run(async () => {
            await firstValueFrom(this._service.resetTotp(uuid));
            this._messageService.add({ severity: 'success', summary: 'Autenticador restablecido', detail: name, life: 3500 });
          }),
      });
    }
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
      this._service.reload();
    } catch {
      // `errorInterceptor` ya avisó.
    }
  }

  private async showCredential(): Promise<void> {
    const credential = this._service.$credential();
    if (!credential || this._dialogOpen) return;
    this._dialogOpen = true;
    this._service.reload();
    const { TempPasswordDialog } = await import('./temp-password-dialog/temp-password-dialog');
    const ref = this._dialogService.open(TempPasswordDialog, {
      header: credential.kind === 'created' ? 'Cuenta creada' : 'Contraseña temporal',
      modal: true,
      closable: false,
      dismissableMask: false,
      closeOnEscape: false,
      style: { width: '95vw', maxWidth: '34rem' },
      data: credential,
    });
    ref?.onClose.subscribe(() => {
      this._dialogOpen = false;
      this._service.clearCredential();
    });
  }
}
