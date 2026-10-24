import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { EvidencePicker, type IPickedEvidence } from '../../../shared/evidence/evidence-picker/evidence-picker';
import { EvidenceAttachService } from '../evidence-attach.service';
import { FormSplit } from '../../../layouts/form-split/form-split';
import { TICKET_QUICK_FORM } from '../ticket-form.config';
import type { TTicketQuickCreate } from '../ticket.types';
import { TicketsStore } from '../tickets.store';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Alta rápida: el mismo `DynamicForm`, embebido en página (FormSplit) en vez de en modal.
 * Protegida con `canGuard('create', 'Ticket')` en tickets.routes.ts.
 *
 * Inputs con prefijo `$` SIEMPRE con corchetes (`[$heading]="'…'"`): un atributo estático
 * `$heading="…"` hace `setAttribute('$heading')` y revienta en runtime (lección de wallet-api).
 */
@Component({
  selector: 'app-ticket-new',
  imports: [Illustration, FormSplit, DynamicForm, EvidencePicker],
  templateUrl: './ticket-new.html',
  styleUrl: './ticket-new.css',
})
export class TicketNew {
  protected readonly _ticketsStore = inject(TicketsStore);
  private readonly _router = inject(Router);
  private readonly _messageService = inject(MessageService);

  private readonly _attacher = inject(EvidenceAttachService);

  protected readonly form = TICKET_QUICK_FORM;
  /** Evidencia elegida (ya validada); se sube al crear el ticket porque el bucket guarda la evidencia POR ticket. */
  protected readonly $files = signal<IPickedEvidence[]>([]);

  protected async create(dto: TTicketQuickCreate): Promise<void> {
    try {
      const ticket = await this._ticketsStore.create(dto);
      const failed = await this._attacher.attach(ticket.uuid, this.$files());
      this._messageService.add({ severity: 'success', summary: 'Ticket creado', detail: ticket.code });
      if (failed > 0) {
        this._messageService.add({ severity: 'warn', summary: 'Falta evidencia', detail: EvidenceAttachService.missingDetail(failed), life: 8000 });
      }
      await this._router.navigate(['/tickets']);
    } catch {
      // El toast lo muestra errorInterceptor; el form conserva los datos.
    }
  }
}
