import {
  CdkDrag,
  CdkDragPlaceholder,
  CdkDropList,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { afterRenderEffect, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { MessageModule } from '@openng/optimus-ui/message';
import { TagModule } from '@openng/optimus-ui/tag';
import { CanPipe } from '../../core/casl/can.pipe';
import { MotionService } from '../../core/motion/motion.service';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_SEVERITY,
  TICKET_STATUS_LABELS,
} from './ticket.constants';
import { TICKET_FORM } from './ticket-form.config';
import { TICKET_STATUS } from './ticket.schema';
import type { TTicket, TTicketStatus, TTicketUpsert } from './ticket.types';
import { TicketsStore } from './tickets.store';

/**
 * Tablero kanban. Alta, edición y vista usan el MISMO `TICKET_FORM` dentro del modal dinámico.
 * Permisos en el template con el pipe `can` (signal): lo que no se puede hacer no se muestra, y
 * «Editar» pasa a «Ver» (modal de solo lectura) si la regla con condiciones no lo permite.
 */
@Component({
  selector: 'app-tickets',
  imports: [
    ButtonModule,
    TagModule,
    MessageModule,
    DatePipe,
    RouterLink,
    CanPipe,
    CdkDropList,
    CdkDrag,
    CdkDragPlaceholder,
  ],
  providers: [DialogService, FormDialogService],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
})
export class Tickets {
  protected readonly _ticketsStore = inject(TicketsStore);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);

  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly prioritySeverity = TICKET_PRIORITY_SEVERITY;
  protected readonly statusOptions = TICKET_STATUS.map((value) => ({
    value,
    label: TICKET_STATUS_LABELS[value],
  }));

  /** Ids de TODAS las listas de columna: cada una acepta tarjetas de las demás. */
  protected readonly $listIds = computed(() => TICKET_STATUS.map((status) => this.listId(status)));

  private readonly $_announcement = signal('');
  protected readonly $announcement = this.$_announcement.asReadonly();

  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _motionService = inject(MotionService);
  private _cardsAnimated = false;

  constructor() {
    // Entrada escalonada de las tarjetas (anime.js) SOLO la primera vez que el tablero carga: al
    // recargar tras guardar, animar de nuevo distrae (WCAG 2.2.2).
    afterRenderEffect(() => {
      if (this._cardsAnimated || this._ticketsStore.$boardState().kind !== 'success') return;
      this._cardsAnimated = true;
      void this._motionService.staggerIn([...this._host.nativeElement.querySelectorAll('.board-card')]);
    });
  }

  protected listId(status: TTicketStatus): string {
    return `board-list-${status}`;
  }

  /** Soltar en OTRA columna cambia el estado; soltar en la misma no hace nada (el orden no se guarda). */
  protected onDrop(event: CdkDragDrop<TTicketStatus, TTicketStatus, TTicket>): void {
    if (event.previousContainer === event.container) return;
    void this.moveTicket(event.item.data, event.container.data);
  }

  /** Alternativa al arrastre: el `<select>` «Mover a…» de la tarjeta. */
  protected onMoveSelect(ticket: TTicket, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const status = select.value as TTicketStatus | '';
    select.value = '';
    if (status) void this.moveTicket(ticket, status);
  }

  private async moveTicket(ticket: TTicket, status: TTicketStatus): Promise<void> {
    const label = TICKET_STATUS_LABELS[status];
    try {
      if (!(await this._ticketsStore.move(ticket, status))) return;
      const message = `${ticket.code} movido a ${label}`;
      this.$_announcement.set(message);
      this._messageService.add({ severity: 'success', summary: message, life: 2500 });
    } catch {
      // `errorInterceptor` ya mostró el toast; la tarjeta volvió sola a su columna.
      this.$_announcement.set(`No se pudo mover ${ticket.code}; sigue en su columna`);
    }
  }

  protected openCreate(): void {
    void this._formDialogService.open({
      header: 'Nuevo ticket',
      definition: TICKET_FORM,
      initialData: { status: 'todo', notifyReporter: true },
      submitLabel: 'Crear ticket',
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto) => this.save(() => this._ticketsStore.create(dto), 'Ticket creado'),
    });
  }

  protected openEdit(ticket: TTicket): void {
    void this._formDialogService.open({
      header: `Editar ${ticket.code}`,
      definition: TICKET_FORM,
      initialData: ticket,
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto: TTicketUpsert) =>
        this.save(() => this._ticketsStore.update(ticket.uuid, dto), 'Ticket actualizado'),
    });
  }

  protected openView(ticket: TTicket): void {
    void this._formDialogService.open({
      header: ticket.code,
      definition: TICKET_FORM,
      initialData: ticket,
      readonlyMode: true,
      submitting: () => false,
      onSubmit: () => undefined,
    });
  }

  /** Éxito → cierra el modal + toast. Error → el toast lo pone errorInterceptor y el modal queda abierto. */
  private async save(request: () => Promise<TTicket>, successMessage: string): Promise<void> {
    try {
      const ticket = await request();
      this._formDialogService.close();
      this._messageService.add({ severity: 'success', summary: successMessage, detail: ticket.code });
    } catch {
      // Sin acción: el modal queda abierto con los datos para reintentar.
    }
  }
}
