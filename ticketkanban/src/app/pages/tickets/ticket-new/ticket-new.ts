import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { DynamicForm } from '../../../shared/dynamic-form/dynamic-form';
import { FormSplit } from '../../../layouts/form-split/form-split';
import { TICKET_QUICK_FORM } from '../ticket-form.config';
import type { TTicketQuickCreate } from '../ticket.types';
import { TicketsStore } from '../tickets.store';

/**
 * Alta rápida: el mismo `DynamicForm`, embebido en página (FormSplit) en vez de en modal.
 * Protegida con `canGuard('create', 'Ticket')` en tickets.routes.ts.
 *
 * Inputs con prefijo `$` SIEMPRE con corchetes (`[$heading]="'…'"`): un atributo estático
 * `$heading="…"` hace `setAttribute('$heading')` y revienta en runtime (lección de wallet-api).
 */
@Component({
  selector: 'app-ticket-new',
  imports: [FormSplit, DynamicForm],
  templateUrl: './ticket-new.html',
  styleUrl: './ticket-new.css',
})
export class TicketNew {
  protected readonly _ticketsStore = inject(TicketsStore);
  private readonly _router = inject(Router);
  private readonly _messageService = inject(MessageService);

  protected readonly form = TICKET_QUICK_FORM;

  protected async create(dto: TTicketQuickCreate): Promise<void> {
    try {
      const ticket = await this._ticketsStore.create(dto);
      this._messageService.add({ severity: 'success', summary: 'Ticket creado', detail: ticket.code });
      await this._router.navigate(['/tickets']);
    } catch {
      // El toast lo muestra errorInterceptor; el form conserva los datos.
    }
  }
}
