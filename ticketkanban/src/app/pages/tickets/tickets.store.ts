import { computed, inject, Injector, Service, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { createStateMachine } from '../../shared/fsm/create-state-machine';
import { toTicketUpsert } from './ticket.mapper';
import { TicketsService } from './tickets.service';
import type {
  TSaveEvent,
  TSaveState,
  TTicket,
  TTicketBoard,
  TTicketQuickCreate,
  TTicketStatus,
  TTicketUpsert,
} from './ticket.types';

/**
 * Estado de la página de tickets. Orquesta `TicketsService` (HTTP) y expone a los componentes
 * SOLO lecturas + métodos de acción (regla de wallet-api: nada escribible hacia afuera).
 *
 * El guardado es una FSM (`createStateMachine`), no un `signal(boolean)`:
 *   idle ─SUBMIT→ saving ─SUCCEED→ saved ─SUBMIT→ saving …
 *                        └─FAIL──→ failed ─SUBMIT→ saving …
 * Un segundo SUBMIT mientras `saving` no es una transición válida → el doble submit (doble
 * click, Enter repetido) queda bloqueado por construcción, sin flags extra.
 *
 * Los métodos de mutación devuelven la promesa y re-lanzan el error: el toast ya lo muestra
 * `errorInterceptor`, y el componente decide la UI (cerrar el modal solo si salió bien).
 */
@Service()
export class TicketsStore {
  private readonly _ticketsService = inject(TicketsService);
  private readonly _injector = inject(Injector);

  private readonly _saveMachine = createStateMachine<TSaveState, TSaveEvent>({
    initial: 'idle',
    states: ['idle', 'saving', 'saved', 'failed'],
    transitions: {
      idle: { SUBMIT: 'saving' },
      saving: { SUCCEED: 'saved', FAIL: 'failed' },
      saved: { SUBMIT: 'saving' },
      failed: { SUBMIT: 'saving' },
    },
  });

  readonly $saveState = this._saveMachine.$state;
  /** Booleano DERIVADO de la FSM (no almacenado): no puede contradecir al estado. */
  readonly $saving = computed(() => this._saveMachine.is('saving'));

  readonly $boardState = computed<TAsyncState<TTicketBoard>>(() => {
    const board = this._ticketsService.board;
    return mapResourceState(board.status(), board.value(), board.error());
  });

  /**
   * Movimientos de tarjeta EN VUELO (uuid → columna destino). Se aplican encima de lo que dice el
   * servidor para que la tarjeta cambie de columna AL SOLTAR (optimista) y no salte de vuelta
   * mientras llega la respuesta; se descartan al terminar (éxito → ya trae el estado nuevo; error →
   * la tarjeta vuelve sola a su columna).
   */
  private readonly $_pendingMoves = signal<ReadonlyMap<string, TTicketStatus>>(new Map());
  readonly $pendingMoves = this.$_pendingMoves.asReadonly();

  /** Tablero con los movimientos en vuelo ya aplicados — lo que se pinta. */
  readonly $boardView = computed<TAsyncState<TTicketBoard>>(() => {
    const state = this.$boardState();
    const pending = this.$_pendingMoves();
    if (state.kind !== 'success' || pending.size === 0) return state;

    const columns = state.data.columns.map((column) => ({ ...column, tickets: [] as TTicket[] }));
    for (const source of state.data.columns) {
      for (const ticket of source.tickets) {
        const status = pending.get(ticket.uuid) ?? ticket.status;
        columns.find((column) => column.status === status)?.tickets.push({ ...ticket, status });
      }
    }
    return { kind: 'success', data: { ...state.data, columns } };
  });

  // ── Listado paginado (BaseApiAbstract.list: paginación y búsqueda de SERVIDOR) ───────────
  readonly $listState = this._ticketsService.$listState;
  readonly $listPagination = this._ticketsService.$pagination;

  setListPage(page: number, take: number): void {
    this._ticketsService.setTake(take);
    this._ticketsService.setPage(page);
  }

  setListSearch(term: string): void {
    this._ticketsService.setSearch(term);
  }

  create(dto: TTicketUpsert | TTicketQuickCreate): Promise<TTicket> {
    return this.mutate(() => firstValueFrom(this._ticketsService.create(dto)));
  }

  update(uuid: string, dto: TTicketUpsert): Promise<TTicket> {
    return this.mutate(() => firstValueFrom(this._ticketsService.update(uuid, dto)));
  }

  /**
   * Mueve un ticket a otra columna (cambia su `status`). Optimista: la tarjeta se mueve de inmediato;
   * si el servidor rechaza (403, 412, red…) vuelve a su columna y `errorInterceptor` avisa. Varios
   * tickets pueden estar en vuelo a la vez, pero NO el mismo dos veces (un segundo arrastre del mismo
   * ticket mientras se guarda el primero se ignora).
   */
  async move(ticket: TTicket, status: TTicketStatus): Promise<boolean> {
    if (ticket.status === status || this.$_pendingMoves().has(ticket.uuid)) return false;
    this.setPending(ticket.uuid, status);
    try {
      await firstValueFrom(
        this._ticketsService.update(ticket.uuid, toTicketUpsert(ticket, { status })),
      );
      await this.reloadBoard();
      return true;
    } finally {
      this.setPending(ticket.uuid, null);
    }
  }

  /** Borrado lógico (DELETE → `softDeleteByUuid` del backend). */
  async remove(uuid: string): Promise<void> {
    await firstValueFrom(this._ticketsService.softDelete(uuid));
    this._ticketsService.reload();
  }

  reload(): void {
    this._ticketsService.reload();
  }

  private setPending(uuid: string, status: TTicketStatus | null): void {
    this.$_pendingMoves.update((current) => {
      const next = new Map(current);
      if (status) next.set(uuid, status);
      else next.delete(uuid);
      return next;
    });
  }

  /** Recarga y ESPERA a que llegue el tablero nuevo: si se soltara el movimiento antes, la tarjeta parpadearía a su columna vieja. */
  private async reloadBoard(): Promise<void> {
    const board = this._ticketsService.board;
    this._ticketsService.reload();
    await firstValueFrom(
      toObservable(board.status, { injector: this._injector }).pipe(
        filter((status) => status !== 'loading' && status !== 'reloading'),
      ),
    );
  }

  private async mutate(request: () => Promise<TTicket>): Promise<TTicket> {
    if (!this._saveMachine.send('SUBMIT')) {
      throw new Error('Ya hay un guardado en curso');
    }
    try {
      const ticket = await request();
      this._saveMachine.send('SUCCEED');
      this._ticketsService.reload();
      return ticket;
    } catch (error) {
      this._saveMachine.send('FAIL');
      throw error;
    }
  }
}
