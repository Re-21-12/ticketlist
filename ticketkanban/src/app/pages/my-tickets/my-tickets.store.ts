import { computed, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { NotificationStreamService } from '../../core/realtime/notification-stream.service';
import { CatalogOptionsService } from '../../shared/catalog-options/catalog-options.service';
import type { IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { toMetaOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { TICKET_PRIORITY, TICKET_STATUS } from '../tickets/ticket.schema';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from '../tickets/ticket.constants';
import { MyTicketsService } from './my-tickets.service';
import type { TMyTicketList, TTicketEventList } from './my-tickets.types';

const byCode = (options: readonly IFieldOption[]): Record<string, IFieldOption> => Object.fromEntries(options.map((option) => [option.value, option]));

/**
 * Estado de pantalla de «Mis tickets» (CU01): la lista de lo que registró la persona, el ticket elegido con su
 * historial y la conexión en tiempo real. Se actualiza solo: cada notificación de un ticket (SSE) y cada reconexión
 * recargan lista e historial; si la conexión en vivo se cae, `$syncAlert` lo dice y `reload()` actualiza a mano (A2).
 */
@Service()
export class MyTicketsStore {
  private readonly _service = inject(MyTicketsService);
  private readonly _stream = inject(NotificationStreamService);
  private readonly _catalogs = inject(CatalogOptionsService);

  private readonly $_sending = signal(false);
  readonly $sending = this.$_sending.asReadonly();

  readonly $listState = computed<TAsyncState<TMyTicketList>>(() => mapResourceState(this._service.list.status(), this._service.list.value(), this._service.list.error()));
  readonly $eventsState = computed<TAsyncState<TTicketEventList>>(() => mapResourceState(this._service.events.status(), this._service.events.value(), this._service.events.error()));
  readonly $selectedUuid = this._service.$uuid;

  /** El ticket elegido, si está entre los de la lista. */
  readonly $selected = computed(() => {
    const state = this.$listState();
    const uuid = this.$selectedUuid();
    return state.kind === 'success' && uuid ? (state.data.data.find((t) => t.uuid === uuid) ?? null) : null;
  });

  /** Estado de la conexión en vivo y alerta de sincronización (A2): sin conexión, o la lista falló. */
  readonly $syncState = this._stream.$state;
  readonly $syncAlert = computed(() => this._stream.$state() === 'offline' || this.$listState().kind === 'error');

  /** código → opción (etiqueta, ícono, color) de los catálogos editables, con las etiquetas del contrato de respaldo. */
  private readonly _statusOptions = this._catalogs.options('ticket-status', toMetaOptions(TICKET_STATUS, TICKET_STATUS_META));
  private readonly _priorityOptions = this._catalogs.options('ticket-priority', toMetaOptions(TICKET_PRIORITY, TICKET_PRIORITY_META));
  readonly $statusByCode = computed(() => byCode(this._statusOptions()));
  readonly $priorityByCode = computed(() => byCode(this._priorityOptions()));

  constructor() {
    // Tiempo real: un aviso sobre un ticket → se vuelve a pedir lista e historial (el estado pudo cambiar).
    this._stream.events$.pipe(takeUntilDestroyed()).subscribe((notification) => {
      if (notification.resourceType === 'Ticket') this.reload();
    });
    // Tras una caída, lo que se perdió se recupera al reconectar.
    this._stream.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.reload());
  }

  select(uuid: string | undefined): void {
    this._service.select(uuid);
  }

  /** «Actualizar» manual: vuelve a pedir todo y, si el canal en vivo está caído, intenta reabrirlo. */
  reload(): void {
    this._service.reload();
  }

  retryConnection(): void {
    this._stream.reconnect();
    this._service.reload();
  }

  /** Agrega un comentario público al ticket elegido y refresca historial y lista (responder puede reanudar el caso). */
  async comment(body: string): Promise<void> {
    const uuid = this.$selectedUuid();
    if (!uuid || this.$_sending()) return;
    this.$_sending.set(true);
    try {
      await firstValueFrom(this._service.comment(uuid, body));
      this._service.reload();
    } finally {
      this.$_sending.set(false);
    }
  }
}
