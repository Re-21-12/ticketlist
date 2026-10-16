import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { EvidencePicker, type IPickedEvidence } from '../../../shared/evidence/evidence-picker/evidence-picker';
import { EvidenceService } from '../../../shared/evidence/evidence.service';
import { MyTicketsService } from '../../my-tickets/my-tickets.service';
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

  private readonly _evidence = inject(EvidenceService);
  private readonly _thread = inject(MyTicketsService);

  protected readonly form = TICKET_QUICK_FORM;
  /** Evidencia elegida (ya validada); se sube al crear el ticket porque el bucket guarda la evidencia POR ticket. */
  protected readonly $files = signal<IPickedEvidence[]>([]);

  protected async create(dto: TTicketQuickCreate): Promise<void> {
    try {
      const ticket = await this._ticketsStore.create(dto);
      const failed = await this.attach(ticket.uuid);
      this._messageService.add({ severity: 'success', summary: 'Ticket creado', detail: ticket.code });
      if (failed > 0) {
        this._messageService.add({ severity: 'warn', summary: 'Falta evidencia', detail: `El ticket se creó, pero ${failed} ${failed === 1 ? 'archivo no se subió' : 'archivos no se subieron'}. Agrégalo como comentario desde «Mis tickets».`, life: 8000 });
      }
      await this._router.navigate(['/tickets']);
    } catch {
      // El toast lo muestra errorInterceptor; el form conserva los datos.
    }
  }

  /**
   * Sube la evidencia al ticket recién creado y la deja como un comentario público («Evidencia adjunta al registrar el
   * ticket») para que aparezca en el historial. Devuelve cuántos archivos NO se pudieron subir (el ticket ya existe).
   */
  private async attach(ticketUuid: string): Promise<number> {
    const files = this.$files();
    if (files.length === 0) return 0;
    const ids: string[] = [];
    for (const { file } of files) {
      try {
        ids.push((await firstValueFrom(this._evidence.upload(ticketUuid, file))).id);
      } catch {
        // El servidor es la última palabra (tipo por firma, duración): `errorInterceptor` ya mostró el motivo.
      }
    }
    if (ids.length > 0) {
      try {
        await firstValueFrom(this._thread.comment(ticketUuid, 'Evidencia adjunta al registrar el ticket.', ids));
      } catch {
        return files.length;
      }
    }
    return files.length - ids.length;
  }
}
