import { computed, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { readProblem } from '../../core/interfaces/problem-details.interface';
import { NotificationStreamService } from '../../core/realtime/notification-stream.service';
import { CatalogOptionsService } from '../../shared/catalog-options/catalog-options.service';
import type { IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { toMetaOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { TICKET_PRIORITY, TICKET_STATUS } from '../tickets/ticket.schema';
import { TICKET_PRIORITY_META, TICKET_STATUS_META } from '../tickets/ticket.constants';
import { MyTicketsService } from './my-tickets.service';
import type { TMyTicketList, TTicketEventList } from './my-tickets.types';

const byCode = (options: readonly IFieldOption[]): Record<string, IFieldOption> => Object.fromEntries(options.map((option) => [option.value, option]));

/** Lo que el backend responde al intentar editar un comentario previo (el historial es inmutable). */
const IMMUTABLE_FALLBACK = 'Los comentarios previos no pueden modificarse';

/**
 * Estado de pantalla de «Mis tickets» (CU01/CU02): la lista de lo que registró la persona, el ticket elegido con su
 * historial, la conexión en tiempo real y las acciones del solicitante (comentar con evidencia, confirmar el cierre o
 * reabrir). Se actualiza solo: cada notificación de un ticket (SSE) y cada reconexión recargan lista e historial; si la
 * conexión en vivo se cae, `$syncAlert` lo dice y `reload()` actualiza a mano (A2 de CU01).
 */
@Service()
export class MyTicketsStore {
  private readonly _service = inject(MyTicketsService);
  private readonly _stream = inject(NotificationStreamService);
  private readonly _catalogs = inject(CatalogOptionsService);

  private readonly $_sending = signal(false);
  readonly $sending = this.$_sending.asReadonly();
  /** `closing` / `reopening` mientras se envía esa acción sobre el ticket (bloquea el doble clic). */
  private readonly $_acting = signal<'closing' | 'reopening' | null>(null);
  readonly $acting = this.$_acting.asReadonly();

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

  /** «Actualizar» manual: vuelve a pedir todo. */
  reload(): void {
    this._service.reload();
  }

  retryConnection(): void {
    this._stream.reconnect();
    this._service.reload();
  }

  /** Agrega un comentario público (con su evidencia) al ticket elegido y refresca historial y lista. */
  async comment(body: string, attachmentIds: readonly string[] = []): Promise<void> {
    const uuid = this.$selectedUuid();
    if (!uuid || this.$_sending()) return;
    this.$_sending.set(true);
    try {
      await firstValueFrom(this._service.comment(uuid, body, attachmentIds));
      this._service.reload();
    } finally {
      this.$_sending.set(false);
    }
  }

  /** «Confirmar cierre»: el ticket pasa a «Cerrado» y queda el evento. Devuelve `false` si no se pudo. */
  async confirmClosure(): Promise<boolean> {
    return this.act('closing', 'closed');
  }

  /** «Reabrir ticket»: pasa a «Reabierto» y el backend avisa al agente asignado (A3). */
  async reopen(reason?: string): Promise<boolean> {
    return this.act('reopening', 'reopened', reason);
  }

  private async act(kind: 'closing' | 'reopening', to: 'closed' | 'reopened', note?: string): Promise<boolean> {
    const uuid = this.$selectedUuid();
    if (!uuid || this.$_acting()) return false;
    this.$_acting.set(kind);
    try {
      await firstValueFrom(this._service.transition(uuid, to, note));
      this._service.reload();
      return true;
    } catch {
      return false; // `errorInterceptor` ya avisó
    } finally {
      this.$_acting.set(null);
    }
  }

  /**
   * A1 de CU02: intenta editar un comentario previo. El backend lo impide siempre; devuelve el motivo para mostrarlo
   * junto al comentario («Los comentarios previos no pueden modificarse»).
   */
  async attemptEdit(commentUuid: string, body: string): Promise<string> {
    const uuid = this.$selectedUuid();
    if (!uuid) return IMMUTABLE_FALLBACK;
    try {
      await firstValueFrom(this._service.editComment(uuid, commentUuid, body));
      return IMMUTABLE_FALLBACK;
    } catch (error) {
      return readProblem(error)?.title ?? IMMUTABLE_FALLBACK;
    }
  }
}
