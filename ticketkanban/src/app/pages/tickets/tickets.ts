import {
  CdkDrag,
  CdkDragPlaceholder,
  CdkDropList,
  type CdkDragDrop,
} from '@angular/cdk/drag-drop';
import { afterRenderEffect, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService, type DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import { MessageModule } from '@openng/optimus-ui/message';
import { SelectModule } from '@openng/optimus-ui/select';
import { CanPipe } from '../../core/casl/can.pipe';
import { MotionService } from '../../core/motion/motion.service';
import type { IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import { Badge } from '../../shared/ui/badge/badge';
import { ElapsedClock } from '../../shared/ui/elapsed-clock/elapsed-clock';
import { SlaRanges } from './sla-ranges/sla-ranges';
import { TicketFilters } from './ticket-filters/ticket-filters';
import { SLA_STATE_META } from './ticket.constants';
import type { IResolveDialogData } from './resolve-dialog/resolve-dialog';
import { TICKET_STATUS_GROUPS } from './ticket.schema';
import type { TTicket, TTicketStatus, TTicketStatusGroup, TTicketUpsert } from './ticket.types';
import { TicketsStore } from './tickets.store';
import { Illustration } from '../../shared/ui/illustration/illustration';

/**
 * Tablero kanban. Alta, edición y vista usan el MISMO `TICKET_FORM` dentro del modal dinámico.
 * Permisos en el template con el pipe `can` (signal): lo que no se puede hacer no se muestra, y
 * «Editar» pasa a «Ver» (modal de solo lectura) si la regla con condiciones no lo permite.
 */
@Component({
  selector: 'app-tickets',
  imports: [Illustration, 
    ButtonModule,
    SelectModule,
    FormsModule,
    Badge,
    ElapsedClock,
    SlaRanges,
    TicketFilters,
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
  private readonly _dialogService = inject(DialogService);
  private _resolveRef: DynamicDialogRef | null = null;
  private readonly _messageService = inject(MessageService);

  /** Etiquetas, íconos y colores vienen de los catálogos (editables); los códigos son los del contrato. */
  protected readonly $departmentByCode = this._ticketsStore.$departmentByCode;
  protected readonly $typeByCode = this._ticketsStore.$typeByCode;
  protected readonly $priorityByCode = this._ticketsStore.$priorityByCode;
  protected readonly $complexityByCode = this._ticketsStore.$complexityByCode;
  protected readonly $statusByCode = this._ticketsStore.$statusByCode;

  /** Ids de TODAS las listas de columna: cada una acepta tarjetas de las demás. */
  protected readonly $listIds = computed(() => TICKET_STATUS_GROUPS.map((group) => this.listId(group)));

  /**
   * «Mover a…» de cada tarjeta: solo los estados que el backend le ofrece a esta persona (`nextStatuses`),
   * con el ícono y el color del catálogo. Una referencia estable por ticket (un arreglo nuevo en cada
   * detección de cambios reiniciaría el `p-select`).
   */
  protected readonly $moveOptions = computed(() => {
    const board = this._ticketsStore.$boardView();
    const byStatus = this._ticketsStore.$statusByCode();
    const result = new Map<string, IFieldOption[]>();
    if (board.kind !== 'success') return result;
    for (const column of board.data.columns) {
      for (const ticket of column.tickets) {
        result.set(
          ticket.uuid,
          ticket.nextStatuses.map((status) => byStatus[status] ?? { value: status, label: status }),
        );
      }
    }
    return result;
  });

  private readonly $_announcement = signal('');
  protected readonly $announcement = this.$_announcement.asReadonly();

  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _motionService = inject(MotionService);
  private _cardsAnimated = false;

  constructor() {
    // El tablero se rotula con los catálogos (editables): al volver a la pantalla se pide fresco, no el de la visita anterior.
    this._ticketsStore.reload();
    // Entrada escalonada de las tarjetas (anime.js) SOLO la primera vez que el tablero carga: al
    // recargar tras guardar, animar de nuevo distrae (WCAG 2.2.2).
    afterRenderEffect(() => {
      if (this._cardsAnimated || this._ticketsStore.$boardState().kind !== 'success') return;
      this._cardsAnimated = true;
      void this._motionService.staggerIn([...this._host.nativeElement.querySelectorAll('.board-card')]);
    });
  }

  /** Estado del plazo de resolución de una tarjeta (insignia + límite); los cerrados no lo muestran. */
  protected slaOf(ticket: TTicket) {
    if (ticket.status === 'closed' || ticket.status === 'resolved') return null;
    const meta = SLA_STATE_META[ticket.sla.resolutionStatus];
    return meta ? { meta, dueAt: ticket.sla.resolutionDueAt } : null;
  }

  protected listId(group: TTicketStatusGroup): string {
    return `board-list-${group}`;
  }

  /**
   * Los estados son variaciones de tres columnas: soltar en una columna lleva al estado «principal» de
   * ese grupo que el flujo permita (atención → En atención, cerrado → Resuelto, nuevo → Reabierto). Las
   * variaciones (Escalado, Pendiente del cliente…) se eligen con «Mover a…».
   */
  private static readonly DROP_TARGETS: Record<TTicketStatusGroup, readonly TTicketStatus[]> = {
    new: ['reopened'],
    in_attention: ['in_progress', 'assigned'],
    closed: ['resolved'],
  };

  private dropTarget(ticket: TTicket, group: TTicketStatusGroup): TTicketStatus | null {
    return Tickets.DROP_TARGETS[group].find((status) => ticket.nextStatuses.includes(status)) ?? null;
  }

  private readonly _enterPredicates = new Map<TTicketStatusGroup, (drag: CdkDrag<TTicket>) => boolean>();

  /**
   * Una columna solo acepta tarjetas que el flujo deja llevar ahí (`nextStatuses`, que decide el backend
   * según el papel de la persona): arrastrar «Nuevo» a «Cerrado» ni siquiera entra. Función cacheada por
   * columna: una nueva en cada ciclo de detección haría que el CDK la reevalúe sin parar.
   */
  protected enterPredicate(group: TTicketStatusGroup): (drag: CdkDrag<TTicket>) => boolean {
    let predicate = this._enterPredicates.get(group);
    if (!predicate) {
      predicate = (drag) => this.dropTarget(drag.data, group) !== null;
      this._enterPredicates.set(group, predicate);
    }
    return predicate;
  }

  /** Soltar en OTRA columna cambia el estado; soltar en la misma no hace nada (el orden no se guarda). */
  protected onDrop(event: CdkDragDrop<TTicketStatusGroup, TTicketStatusGroup, TTicket>): void {
    if (event.previousContainer === event.container) return;
    const status = this.dropTarget(event.item.data, event.container.data);
    if (status) this.requestMove(event.item.data, status);
  }

  /** Alternativa al arrastre: el `p-select` «Mover a…» de la tarjeta. */
  protected onMoveSelect(ticket: TTicket, status: TTicketStatus | null): void {
    if (status) this.requestMove(ticket, status);
  }

  /** Atajo del caso más común: pasar de «Asignado» a «En atención» (arranca el reloj). */
  protected startAttention(ticket: TTicket): void {
    this.requestMove(ticket, 'in_progress');
  }

  /** Resolver exige documentar la solución: abre el modal; el resto de cambios van directo. */
  private requestMove(ticket: TTicket, status: TTicketStatus): void {
    if (status !== 'resolved') {
      void this.moveTicket(ticket, status);
      return;
    }
    void this.openResolve(ticket);
  }

  /**
   * Modal «Resolver»: la solución (obligatoria) y la evidencia (fotos, informes, videos cortos) que el solicitante verá en su
   * historial. Es un componente propio (no el formulario dinámico) porque lleva el selector de evidencia.
   */
  private async openResolve(ticket: TTicket): Promise<void> {
    if (this._resolveRef) return;
    const { ResolveDialog } = await import('./resolve-dialog/resolve-dialog');
    const submitting = this._ticketsStore.$saving;
    const data: IResolveDialogData = {
      ticketUuid: ticket.uuid,
      code: ticket.code,
      submitting,
      onSubmit: ({ resolution, attachmentIds }) => {
        void this.moveTicket(ticket, 'resolved', { resolution, attachmentIds }).then(() => this.closeResolve());
      },
    };
    this._resolveRef = this._dialogService.open(ResolveDialog, {
      header: `Resolver ${ticket.code}`,
      modal: true,
      // Getter vivo: la X se deshabilita mientras hay un request en vuelo.
      get closable(): boolean {
        return !submitting();
      },
      dismissableMask: false,
      closeOnEscape: false,
      style: { width: '95vw', maxWidth: '40rem' },
      contentStyle: { 'max-height': '75vh', 'overflow-y': 'auto' },
      data,
    });
    this._resolveRef?.onClose.subscribe(() => (this._resolveRef = null));
  }

  private closeResolve(): void {
    this._resolveRef?.close();
    this._resolveRef = null;
  }

  private async moveTicket(ticket: TTicket, status: TTicketStatus, extra: { resolution?: string; attachmentIds?: string[] } = {}): Promise<void> {
    const label = this._ticketsStore.$statusLabels()[status] ?? status;
    try {
      if (!(await this._ticketsStore.move(ticket, status, extra))) return;
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
      definition: this._ticketsStore.$form(),
      // `assigneeEmail: ''` = «Sin asignar» (un select sin valor arrancaría en `null`, que el contrato rechaza).
      initialData: { notifyReporter: true, assigneeEmail: '' },
      optionsByField: () => this._ticketsStore.formOptions(),
      submitLabel: 'Crear ticket',
      submitting: this._ticketsStore.$saving,
      onSubmit: (dto) => this.save(() => this._ticketsStore.create(dto), 'Ticket creado'),
    });
  }

  protected openEdit(ticket: TTicket): void {
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

  protected openView(ticket: TTicket): void {
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
