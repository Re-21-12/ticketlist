import { Component, computed, inject } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { confirmDelete } from '../../../shared/confirm/confirm-delete.util';
import { DynamicTable } from '../../../shared/dynamic-table/dynamic-table';
import type { ITablePage, TTableRow } from '../../../shared/dynamic-table/dynamic-table.interface';
import { FormDialogService } from '../../../shared/form-dialog/form-dialog.service';
import { TICKET_FORM } from '../ticket-form.config';
import { TICKET_TABLE } from '../ticket-table.config';
import type { TTicket, TTicketUpsert } from '../ticket.types';
import { TicketsStore } from '../tickets.store';

/**
 * Listado paginado de tickets: `app-dynamic-table` (cards en mobile) sobre `BaseApiAbstract.list`
 * (paginación y búsqueda en el SERVIDOR) + el mismo modal dinámico del tablero para alta/edición.
 */
@Component({
  selector: 'app-ticket-list',
  imports: [DynamicTable],
  providers: [DialogService, FormDialogService],
  templateUrl: './ticket-list.html',
  styleUrl: './ticket-list.css',
})
export class TicketList {
  protected readonly _ticketsStore = inject(TicketsStore);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  protected readonly tableConfig = TICKET_TABLE;

  protected readonly $rows = computed<TTableRow[]>(() => {
    const state = this._ticketsStore.$listState();
    return state.kind === 'success' ? state.data.data : [];
  });
  protected readonly $total = computed(() => {
    const state = this._ticketsStore.$listState();
    return state.kind === 'success' ? state.data.meta.total : 0;
  });
  protected readonly $loading = computed(() => this._ticketsStore.$listState().kind === 'loading');
  protected readonly $failed = computed(() => this._ticketsStore.$listState().kind === 'error');

  protected onPage({ page, take }: ITablePage): void {
    this._ticketsStore.setListPage(page, take);
  }

  protected onCreate(): void {
    void this._formDialogService.open({
      header: 'Nuevo ticket',
      definition: TICKET_FORM,
      initialData: { status: 'todo', notifyReporter: true },
      submitLabel: 'Crear ticket',
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto) => this.save(() => this._ticketsStore.create(dto), 'Ticket creado'),
    });
  }

  protected onEdit(row: TTableRow): void {
    const ticket = row as TTicket;
    void this._formDialogService.open({
      header: `Editar ${ticket.code}`,
      definition: TICKET_FORM,
      initialData: ticket,
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto: TTicketUpsert) =>
        this.save(() => this._ticketsStore.update(ticket.uuid, dto), 'Ticket actualizado'),
    });
  }

  protected onView(row: TTableRow): void {
    const ticket = row as TTicket;
    void this._formDialogService.open({
      header: ticket.code,
      definition: TICKET_FORM,
      initialData: ticket,
      readonlyMode: true,
      submitting: () => false,
      onSubmit: () => undefined,
    });
  }

  protected onDelete(row: TTableRow): void {
    const ticket = row as TTicket;
    confirmDelete(this._confirmationService, {
      header: 'Eliminar ticket',
      message: `¿Eliminar ${ticket.code} «${ticket.title}»? Se quitará del listado.`,
      accept: () => void this.remove(ticket),
    });
  }

  private async remove(ticket: TTicket): Promise<void> {
    try {
      await this._ticketsStore.remove(ticket.uuid);
      this._messageService.add({ severity: 'success', summary: 'Ticket eliminado', detail: ticket.code });
    } catch {
      // El toast del error lo muestra errorInterceptor.
    }
  }

  private async save(request: () => Promise<TTicket>, successMessage: string): Promise<void> {
    try {
      const ticket = await request();
      this._formDialogService.close();
      this._messageService.add({ severity: 'success', summary: successMessage, detail: ticket.code });
    } catch {
      // El modal queda abierto con los datos para reintentar.
    }
  }
}
