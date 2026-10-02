import { Component, computed, inject } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { confirmDelete } from '../../../shared/confirm/confirm-delete.util';
import { DynamicTable } from '../../../shared/dynamic-table/dynamic-table';
import type { IFieldOption } from '../../../shared/dynamic-form/field-config.interface';
import type { ITableConfig, ITablePage, TTableRow } from '../../../shared/dynamic-table/dynamic-table.interface';
import { FormDialogService } from '../../../shared/form-dialog/form-dialog.service';
import { TICKET_TABLE } from '../ticket-table.config';
import { TicketFilters } from '../ticket-filters/ticket-filters';
import type { TTicket, TTicketUpsert } from '../ticket.types';
import { TicketsStore } from '../tickets.store';
import { Illustration } from '../../../shared/ui/illustration/illustration';

/**
 * Listado paginado de tickets: `app-dynamic-table` (cards en mobile) sobre `BaseApiAbstract.list`
 * (paginación y búsqueda en el SERVIDOR) + el mismo modal dinámico del tablero para alta/edición.
 */
@Component({
  selector: 'app-ticket-list',
  imports: [Illustration, TicketFilters, DynamicTable],
  providers: [DialogService, FormDialogService],
  templateUrl: './ticket-list.html',
  styleUrl: './ticket-list.css',
})
export class TicketList {
  protected readonly _ticketsStore = inject(TicketsStore);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  /** Columnas con las etiquetas de los catálogos (editables) en lugar de las del contrato. */
  protected readonly $tableConfig = computed<ITableConfig>(() => {
    const options: Record<string, IFieldOption[]> = {
      department: this._ticketsStore.$departmentOptions(),
      type: this._ticketsStore.$typeOptions(),
      category: this._ticketsStore.$categoryOptions(),
      complexity: this._ticketsStore.$complexityOptions(),
      priority: this._ticketsStore.$priorityOptions(),
      status: this._ticketsStore.$statusOptions(),
    };
    return {
      ...TICKET_TABLE,
      columns: TICKET_TABLE.columns.map((column) =>
        options[column.field] ? { ...column, options: options[column.field] } : column,
      ),
    };
  });

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
      definition: this._ticketsStore.$form(),
      initialData: { notifyReporter: true, assigneeEmail: '' },
      optionsByField: () => this._ticketsStore.formOptions(),
      submitLabel: 'Crear ticket',
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto) => this.save(() => this._ticketsStore.create(dto), 'Ticket creado'),
    });
  }

  protected onEdit(row: TTableRow): void {
    const ticket = row as TTicket;
    void this._formDialogService.open({
      header: `Editar ${ticket.code}`,
      definition: this._ticketsStore.$form(),
      initialData: ticket,
      optionsByField: () => this._ticketsStore.formOptions(ticket.assigneeEmail),
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto: TTicketUpsert) =>
        this.save(() => this._ticketsStore.update(ticket.uuid, dto), 'Ticket actualizado'),
    });
  }

  protected onView(row: TTableRow): void {
    const ticket = row as TTicket;
    void this._formDialogService.open({
      header: ticket.code,
      definition: this._ticketsStore.$form(),
      initialData: ticket,
      optionsByField: () => this._ticketsStore.formOptions(ticket.assigneeEmail),
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
