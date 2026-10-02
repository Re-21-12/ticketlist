import { computed, inject, Injector, Service, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { mapResourceState, type TAsyncState } from '../../core/interfaces/async-state.types';
import { SessionStore } from '../../core/session/session.store';
import { CatalogOptionsService } from '../../shared/catalog-options/catalog-options.service';
import type { IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import { toMetaOptions } from '../../shared/dynamic-form/utils/to-options.util';
import { createStateMachine } from '../../shared/fsm/create-state-machine';
import { toAssigneeOptions } from './ticket.mapper';
import { TICKET_CATEGORY, TICKET_COMPLEXITY, TICKET_PRIORITY, TICKET_STATUS, TICKET_TYPE } from './ticket.schema';
import {
  TICKET_CATEGORY_META,
  TICKET_COMPLEXITY_META,
  TICKET_PRIORITY_META,
  TICKET_STATUS_META,
  TICKET_DEPARTMENT_FALLBACK,
  TICKET_TYPE_META,
} from './ticket.constants';
import { TICKET_CUSTOMER_FORM, TICKET_FORM } from './ticket-form.config';
import { activeFilterCount, EMPTY_TICKET_FILTERS, filterTickets, serverFilters, type ITicketFilters } from './ticket-filter.util';
import { TicketsService } from './tickets.service';
import type {
  TSaveEvent,
  TSaveState,
  TTicket,
  TTicketBoard,
  TAssignee,
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
  private readonly _catalogs = inject(CatalogOptionsService);
  private readonly _session = inject(SessionStore);

  /** Formulario según el rol: el equipo fija complejidad, estimación y responsable; el cliente los ve sin cambiarlos. */
  readonly $form = computed(() => (this._session.$isTeam() ? TICKET_FORM : TICKET_CUSTOMER_FORM));

  /**
   * Opciones de categoría, prioridad y estado: salen de los CATÁLOGOS (editables por un administrador)
   * y caen a las etiquetas del contrato mientras cargan. Los códigos son los mismos que valida Zod.
   */
  readonly $typeOptions = this._catalogs.options('ticket-type', toMetaOptions(TICKET_TYPE, TICKET_TYPE_META));
  readonly $categoryOptions = this._catalogs.options('ticket-category', toMetaOptions(TICKET_CATEGORY, TICKET_CATEGORY_META));
  readonly $priorityOptions = this._catalogs.options('ticket-priority', toMetaOptions(TICKET_PRIORITY, TICKET_PRIORITY_META));
  readonly $complexityOptions = this._catalogs.options('ticket-complexity', toMetaOptions(TICKET_COMPLEXITY, TICKET_COMPLEXITY_META));
  readonly $departmentOptions = this._catalogs.options('ticket-department', [TICKET_DEPARTMENT_FALLBACK], true);
  readonly $statusOptions = this._catalogs.options('ticket-status', toMetaOptions(TICKET_STATUS, TICKET_STATUS_META));

  /** código → etiqueta, para pintar avisos. */
  readonly $priorityLabels = computed(() => labelsOf(this.$priorityOptions()));
  readonly $statusLabels = computed(() => labelsOf(this.$statusOptions()));
  /** código → opción (etiqueta + ícono + color) para las insignias de las tarjetas. */
  readonly $departmentByCode = computed(() => byCode(this.$departmentOptions()));
  readonly $typeByCode = computed(() => byCode(this.$typeOptions()));
  readonly $priorityByCode = computed(() => byCode(this.$priorityOptions()));
  readonly $complexityByCode = computed(() => byCode(this.$complexityOptions()));
  readonly $statusByCode = computed(() => byCode(this.$statusOptions()));

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

  /** Personal asignable (vacío mientras carga o si falla: el formulario sigue usable con «Sin asignar»). */
  readonly $assignees = computed<TAssignee[]>(() => {
    const assignees = this._ticketsService.assignees;
    return assignees.hasValue() ? assignees.value().data : [];
  });

  /** Tablero con los movimientos en vuelo ya aplicados — lo que se pinta. */
  readonly $boardView = computed<TAsyncState<TTicketBoard>>(() => {
    const state = this.$boardState();
    const pending = this.$_pendingMoves();
    if (state.kind !== 'success' || pending.size === 0) return state;

    const columns = state.data.columns.map((column) => ({ ...column, tickets: [] as TTicket[] }));
    for (const source of state.data.columns) {
      for (const ticket of source.tickets) {
        const status = pending.get(ticket.uuid) ?? ticket.status;
        columns.find((column) => column.statuses.includes(status))?.tickets.push({ ...ticket, status });
      }
    }
    return { kind: 'success', data: { ...state.data, columns } };
  });

  // ── Filtros de búsqueda (los comparten el tablero y el listado) ─────────────────────────────────
  private readonly $_filters = signal<ITicketFilters>(EMPTY_TICKET_FILTERS);
  readonly $filters = this.$_filters.asReadonly();
  readonly $activeFilters = computed(() => activeFilterCount(this.$_filters()));

  /** El tablero ya trae todos los tickets: se filtra en el cliente (buscar es instantáneo). */
  readonly $visibleBoard = computed<TAsyncState<TTicketBoard>>(() => {
    const state = this.$boardView();
    const filters = this.$_filters();
    if (state.kind !== 'success' || activeFilterCount(filters) === 0) return state;
    const user = this._session.$user();
    const me = user ? { uuid: user.uuid, email: user.email } : null;
    return {
      kind: 'success',
      data: { ...state.data, columns: state.data.columns.map((column) => ({ ...column, tickets: filterTickets(column.tickets, filters, me) })) },
    };
  });

  /** «Mostrando n de m» del tablero. */
  readonly $boardCounts = computed(() => {
    const total = (state: TAsyncState<TTicketBoard>) => (state.kind === 'success' ? state.data.columns.reduce((sum, column) => sum + column.tickets.length, 0) : 0);
    return { shown: total(this.$visibleBoard()), total: total(this.$boardView()) };
  });

  /** Cambia criterios; el listado paginado recibe los que el backend filtra (y vuelve a la página 1). */
  setFilters(changes: Partial<ITicketFilters>): void {
    const next = { ...this.$_filters(), ...changes };
    this.$_filters.set(next);
    this._ticketsService.setFilters(serverFilters(next));
    // El buscador del listado vive en la barra de la tabla: solo se toca si este cambio trae texto.
    if (changes.search !== undefined) this._ticketsService.setSearch(next.search);
    this._ticketsService.setPage(1);
  }

  clearFilters(): void {
    this.setFilters(EMPTY_TICKET_FILTERS);
  }

  /** Opciones de selects que llegan en runtime para los formularios de ticket (catálogos + personal). */
  formOptions(currentAssignee?: string | null): Record<string, IFieldOption[]> {
    return {
      department: this.$departmentOptions(),
      type: this.$typeOptions(),
      category: this.$categoryOptions(),
      complexity: this.$complexityOptions(),
      priority: this.$priorityOptions(),
      status: this.$statusOptions(),
      assigneeEmail: toAssigneeOptions(this.$assignees(), currentAssignee),
    };
  }

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
  async move(ticket: TTicket, status: TTicketStatus, extra: { resolution?: string; note?: string } = {}): Promise<boolean> {
    // Solo a los estados que el backend le ofreció a ESTA persona (`nextStatuses`): lo demás es 409.
    if (ticket.status === status || !ticket.nextStatuses.includes(status) || this.$_pendingMoves().has(ticket.uuid)) return false;
    this.setPending(ticket.uuid, status);
    try {
      await firstValueFrom(this._ticketsService.transition(ticket.uuid, { to: status, ...extra }));
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

function labelsOf(options: readonly IFieldOption[]): Record<string, string> {
  return Object.fromEntries(options.map((option) => [String(option.value), option.label]));
}

function byCode(options: readonly IFieldOption[]): Record<string, IFieldOption> {
  return Object.fromEntries(options.map((option) => [String(option.value), option]));
}
