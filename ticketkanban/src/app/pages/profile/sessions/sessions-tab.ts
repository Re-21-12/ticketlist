import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { TagModule } from '@openng/optimus-ui/tag';
import { confirmDelete } from '../../../shared/confirm/confirm-delete.util';
import { ProfileStore } from '../profile.store';
import type { TSessionInfo } from '../profile.types';
import { describeUserAgent } from '../session-display.util';

/**
 * Pestaña «Sesiones»: dónde está abierta tu cuenta, con opción de cerrar cada una o todas las demás.
 * La sesión actual se marca y no se puede cerrar desde aquí (para eso está «Cerrar sesión»).
 */
@Component({
  selector: 'app-sessions-tab',
  imports: [DatePipe, ButtonModule, TagModule],
  templateUrl: './sessions-tab.html',
  styleUrl: './sessions-tab.css',
})
export class SessionsTab {
  protected readonly _profileStore = inject(ProfileStore);
  private readonly _confirmationService = inject(ConfirmationService);
  private readonly _messageService = inject(MessageService);

  protected readonly $otherCount = computed(() => {
    const state = this._profileStore.$sessionsState();
    return state.kind === 'success' ? state.data.data.filter((s) => !s.current).length : 0;
  });

  protected display(session: TSessionInfo) {
    return describeUserAgent(session.userAgent);
  }

  protected askRevoke(session: TSessionInfo): void {
    confirmDelete(this._confirmationService, {
      header: 'Cerrar sesión',
      message: `¿Cerrar la sesión de ${this.display(session).label} (${session.ipAddress})? Quien la use tendrá que volver a iniciar sesión.`,
      acceptLabel: 'Cerrar sesión',
      accept: () => void this.run(() => this._profileStore.revokeSession(session.id), 'Sesión cerrada'),
    });
  }

  protected askRevokeOthers(): void {
    confirmDelete(this._confirmationService, {
      header: 'Cerrar las demás sesiones',
      message: `Se cerrarán ${this.$otherCount()} sesión(es). Esta seguirá abierta.`,
      acceptLabel: 'Cerrar las demás',
      accept: () => void this.run(() => this._profileStore.revokeOtherSessions(), 'Otras sesiones cerradas'),
    });
  }

  private async run(action: () => Promise<void>, success: string): Promise<void> {
    try {
      await action();
      this._messageService.add({ severity: 'success', summary: success, life: 2500 });
    } catch {
      // `errorInterceptor` ya avisó; la lista se queda como estaba.
    }
  }
}
