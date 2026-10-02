import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';
import { FormDialogService } from '../../../shared/form-dialog/form-dialog.service';
import { TICKET_SURVEY_FORM } from '../../tickets/survey-form.config';
import { TicketsService } from '../../tickets/tickets.service';
import type { TNotification } from '../profile.types';
import { NOTIFICATION_ICONS } from '../profile.constants';
import { ProfileStore } from '../profile.store';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Pestaña «Notificaciones»: las tuyas, de más nueva a más vieja; se marcan como leídas una a una.
 * Una `TICKET_SURVEY` (el ticket que solicitaste se cerró) ofrece «Calificar»: abre la encuesta de satisfacción
 * (1–5, comentario opcional). Una `ACCOUNT_LOCKED` (para administración) lleva a «Usuarios» a desbloquearla.
 */
@Component({
  selector: 'app-notifications-tab',
  imports: [Illustration, DatePipe, ButtonModule, RouterLink],
  providers: [DialogService, FormDialogService],
  templateUrl: './notifications-tab.html',
  styleUrl: './notifications-tab.css',
})
export class NotificationsTab {
  protected readonly _profileStore = inject(ProfileStore);
  private readonly _ticketsService = inject(TicketsService);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  protected readonly icons = NOTIFICATION_ICONS;

  protected async markRead(uuid: string): Promise<void> {
    try {
      await this._profileStore.markNotificationRead(uuid);
    } catch {
      // `errorInterceptor` ya avisó.
    }
  }

  /** Abre la encuesta si sigue pendiente; si ya se respondió o venció, lo dice en vez de abrir un formulario inútil. */
  protected async rate(item: TNotification): Promise<void> {
    const ticketUuid = item.resourceUuid;
    if (!ticketUuid) return;
    try {
      const survey = await firstValueFrom(this._ticketsService.survey(ticketUuid));
      if (survey.state !== 'pending') {
        this._messageService.add({
          severity: 'info',
          summary: survey.state === 'answered' ? 'Ya calificaste este ticket' : 'La encuesta venció',
          detail: survey.state === 'answered' ? `Tu calificación fue ${survey.score} de 5. ¡Gracias!` : 'Tuvo 7 días para responderse.',
        });
        return;
      }
    } catch {
      return; // `errorInterceptor` ya avisó
    }
    void this._formDialogService.open({
      header: '¿Cómo te atendimos?',
      definition: TICKET_SURVEY_FORM,
      submitLabel: 'Enviar calificación',
      submitting: () => false,
      onSubmit: (form) => void this.send(item, ticketUuid, form),
    });
  }

  private async send(item: TNotification, ticketUuid: string, form: { score: number; comment: string }): Promise<void> {
    try {
      await firstValueFrom(this._ticketsService.answerSurvey(ticketUuid, form));
      this._formDialogService.close();
      this._messageService.add({ severity: 'success', summary: '¡Gracias por calificar!', detail: `Tu calificación: ${form.score} de 5.` });
      if (!item.readAt) await this.markRead(item.uuid);
    } catch {
      // Ya respondida / vencida: `errorInterceptor` avisó y el modal queda para cerrarlo.
    }
  }
}
