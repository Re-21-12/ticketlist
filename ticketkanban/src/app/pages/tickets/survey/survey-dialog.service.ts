import { inject, Service } from '@angular/core';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { FormDialogService } from '../../../shared/form-dialog/form-dialog.service';
import { TICKET_SURVEY_FORM } from '../survey-form.config';
import type { TSurveyForm } from '../ticket.types';
import { TicketsService } from '../tickets.service';

/**
 * Encuesta de cierre (CU02) en un modal: ¿se resolvió el problema?, calificación 1–5 y comentario opcional. La usan la
 * pestaña de notificaciones del perfil («Calificar») y «Mis tickets» (justo después de confirmar el cierre). Cada pantalla
 * declara `providers: [DialogService, FormDialogService, SurveyDialogService]` (los dos primeros no son globales).
 */
@Service({ autoProvided: false })
export class SurveyDialogService {
  private readonly _ticketsService = inject(TicketsService);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);

  /**
   * Abre la encuesta si sigue pendiente; si ya se respondió o venció, lo dice en vez de abrir un formulario inútil.
   * `onAnswered` se llama al enviar la respuesta (p. ej. para marcar leído el aviso).
   */
  async rate(ticketUuid: string, onAnswered?: () => void | Promise<void>): Promise<void> {
    try {
      const survey = await firstValueFrom(this._ticketsService.survey(ticketUuid));
      if (survey.state !== 'pending') {
        this._messageService.add({
          severity: 'info',
          summary: survey.state === 'answered' ? 'Ya respondiste esta encuesta' : 'La encuesta venció',
          detail: survey.state === 'answered' ? `Tu calificación fue ${survey.score} de 5. ¡Gracias!` : 'Tuvo 7 días para responderse.',
        });
        return;
      }
    } catch {
      return; // `errorInterceptor` ya avisó
    }
    void this._formDialogService.open({
      header: '¿Se resolvió tu problema?',
      definition: TICKET_SURVEY_FORM,
      submitLabel: 'Enviar respuesta',
      submitting: () => false,
      onSubmit: (form) => void this.send(ticketUuid, form, onAnswered),
    });
  }

  private async send(ticketUuid: string, form: TSurveyForm, onAnswered?: () => void | Promise<void>): Promise<void> {
    try {
      await firstValueFrom(this._ticketsService.answerSurvey(ticketUuid, form));
      this._formDialogService.close();
      this._messageService.add({ severity: 'success', summary: '¡Gracias por responder!', detail: `Tu calificación: ${form.score} de 5.` });
      await onAnswered?.();
    } catch {
      // Ya respondida / vencida: `errorInterceptor` avisó y el modal queda para cerrarlo.
    }
  }
}
