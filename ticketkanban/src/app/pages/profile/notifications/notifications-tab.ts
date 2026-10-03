import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { FormDialogService } from '../../../shared/form-dialog/form-dialog.service';
import { SurveyDialogService } from '../../tickets/survey/survey-dialog.service';
import type { TNotification } from '../profile.types';
import { NOTIFICATION_ICONS } from '../profile.constants';
import { ProfileStore } from '../profile.store';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Pestaña «Notificaciones»: las tuyas, de más nueva a más vieja; se marcan como leídas una a una.
 * Una `TICKET_SURVEY` (el ticket que solicitaste se cerró) ofrece «Calificar»: abre la encuesta de cierre
 * (¿se resolvió?, 1–5, comentario opcional). Una `ACCOUNT_LOCKED` (para administración) lleva a «Usuarios» a desbloquearla.
 */
@Component({
  selector: 'app-notifications-tab',
  imports: [Illustration, DatePipe, ButtonModule, RouterLink],
  providers: [DialogService, FormDialogService, SurveyDialogService],
  templateUrl: './notifications-tab.html',
  styleUrl: './notifications-tab.css',
})
export class NotificationsTab {
  protected readonly _profileStore = inject(ProfileStore);
  private readonly _surveyDialog = inject(SurveyDialogService);
  protected readonly icons = NOTIFICATION_ICONS;

  protected async markRead(uuid: string): Promise<void> {
    try {
      await this._profileStore.markNotificationRead(uuid);
    } catch {
      // `errorInterceptor` ya avisó.
    }
  }

  /** Abre la encuesta de cierre (¿se resolvió?, 1–5, comentario opcional) y, al responderla, marca leído el aviso. */
  protected async rate(item: TNotification): Promise<void> {
    if (!item.resourceUuid) return;
    await this._surveyDialog.rate(item.resourceUuid, async () => {
      if (!item.readAt) await this.markRead(item.uuid);
    });
  }
}
