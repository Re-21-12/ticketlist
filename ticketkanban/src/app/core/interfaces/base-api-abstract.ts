import { computed, inject, signal, type Signal } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpStatusCode,
  httpResource,
} from '@angular/common/http';
import { catchError, map, of, type Observable } from 'rxjs';
import { suppressErrorToast } from '../interceptors/suppress-error-toast.token';
import { mapResourceState, type TAsyncState } from './async-state.types';
import type { IPaginatedResult } from './paginated-result.interface';

/**
 * Base reactiva de un recurso CRUD (port de `BaseApiAbstract` de wallet-api), espejo del
 * `IBaseController` del backend:
 *
 * Backend (ticketlistbe)     HTTP                    Frontend
 * ─────────────────────────────────────────────────────────────────────────
 * findAll(pagination, f)     GET    /                list   (httpResource)
 * findOneByUuid(uuid)        GET    /:uuid           item   (httpResource)
 * create(dto)                POST   /                create()     Observable
 * update(uuid, dto)          PATCH  /:uuid           update()     Observable
 * softDeleteByUuid(uuid)     DELETE /:uuid           softDelete() Observable
 * restoreByUuid(uuid)        PATCH  /:uuid/restore   restore()    Observable
 * existsByUuid(uuid)         HEAD   /:uuid           exists()     Observable<boolean>
 *
 * Lecturas con `httpResource` (cancela el request anterior si cambian filtros/página — sin
 * condiciones de carrera al paginar rápido); mutaciones con `HttpClient` (la doc de Angular
 * desaconseja `httpResource` para POST/PATCH).
 *
 * Diferencia con wallet-api: `parseItem()` es el punto donde la subclase valida la respuesta con
 * su schema Zod (`TicketSchema.parse`), así el tipo `TResponse` es real y no un cast de JSON.
 *
 * ```ts
 * @Service()
 * export class TicketsService extends BaseApiAbstract<TTicket, TTicketUpsert, TTicketUpsert> {
 *   protected readonly endpoint = '/api/tickets';
 *   protected readonly $uuid = signal<string | undefined>(undefined);
 *   protected override parseItem(raw: unknown) { return TicketSchema.parse(raw); }
 * }
 * ```
 */
export abstract class BaseApiAbstract<
  TResponse,
  TCreate = Partial<TResponse>,
  TUpdate = Partial<TResponse>,
  TFilter extends object = Record<string, string>,
> {
  protected readonly _http = inject(HttpClient);

  /** URL base sin barra final, p. ej. '/api/tickets'. */
  protected abstract readonly endpoint: string;

  /** UUID que alimenta `item`; `undefined` deja el resource en idle. */
  protected abstract readonly $uuid: Signal<string | undefined>;

  /** Filtros de `list` como query params; `undefined` = sin filtros. */
  protected readonly $filters = signal<TFilter | undefined>(undefined);

  /** `true` = `list` no dispara hasta que haya filtros (backends que exigen un filtro). */
  protected readonly listRequiresFilter: boolean = false;

  /** Página 1-indexada, igual que `BasePaginationSchema` del backend. */
  protected readonly $page = signal(1);
  protected readonly $take = signal(10);
  protected readonly $search = signal('');
  protected readonly $sortBy = signal<string | null>(null);
  protected readonly $sortOrder = signal<'ASC' | 'DESC' | null>(null);

  /** Página/tamaño actuales, solo lectura (para enlazar el paginador de la tabla). */
  readonly $pagination = computed(() => ({ page: this.$page(), take: this.$take() }));

  /** Hook de validación de la respuesta — la subclase lo sobreescribe con su schema Zod. */
  protected parseItem(raw: unknown): TResponse {
    return raw as TResponse;
  }

  setPage(page: number): void {
    this.$page.set(page);
  }

  setTake(take: number): void {
    this.$take.set(take);
  }

  setSearch(search: string): void {
    this.$search.set(search.trim());
    this.$page.set(1);
  }

  setFilters(filters: TFilter | undefined): void {
    this.$filters.set(filters);
    this.$page.set(1);
  }

  /** `field: null` vuelve al orden por defecto del backend; siempre regresa a la página 1. */
  setSort(field: string | null, order: 'ASC' | 'DESC' | null = 'ASC'): void {
    this.$sortBy.set(field);
    this.$sortOrder.set(field ? order : null);
    this.$page.set(1);
  }

  private readonly $_itemUrl = computed(() => {
    const uuid = this.$uuid();
    return uuid !== undefined ? `${this.endpoint}/${uuid}` : undefined;
  });

  /** findAll — re-consulta cuando cambian filtros/página/tamaño/búsqueda/orden. */
  readonly list = httpResource<IPaginatedResult<TResponse>>(
    () => {
      if (this.listRequiresFilter && !this.$filters()) return undefined;
      return {
        url: this.endpoint,
        params: {
          ...this.$filters(),
          ...(this.$search() ? { search: this.$search() } : {}),
          ...(this.$sortBy() ? { sortBy: this.$sortBy(), sortOrder: this.$sortOrder() } : {}),
          page: this.$page(),
          take: this.$take(),
        } as Record<string, string | number | boolean>,
      };
    },
    // Closure (no referencia directa): los campos de la subclase aún no existen cuando se
    // inicializa este campo de la clase base.
    {
      parse: (raw) => {
        const page = raw as IPaginatedResult<unknown>;
        return { data: page.data.map((item) => this.parseItem(item)), meta: page.meta };
      },
    },
  );

  /** findOneByUuid — re-consulta cuando cambia `$uuid()`; idle mientras sea `undefined`. */
  readonly item = httpResource<TResponse>(
    () => {
      const url = this.$_itemUrl();
      return url !== undefined ? { url } : undefined;
    },
    { parse: (raw) => this.parseItem(raw) },
  );

  readonly $listState = computed<TAsyncState<IPaginatedResult<TResponse>>>(() =>
    mapResourceState(this.list.status(), this.list.value(), this.list.error()),
  );
  readonly $listIsLoading = computed(() => this.$listState().kind === 'loading');
  readonly $listError = computed<HttpErrorResponse | undefined>(() => {
    const state = this.$listState();
    return state.kind === 'error' ? state.error : undefined;
  });
  readonly $itemState = computed<TAsyncState<TResponse>>(() =>
    mapResourceState(this.item.status(), this.item.value(), this.item.error()),
  );

  create(dto: TCreate, context?: HttpContext): Observable<TResponse> {
    return this._http
      .post<unknown>(this.endpoint, dto, context ? { context } : undefined)
      .pipe(map((raw) => this.parseItem(raw)));
  }

  /** PATCH, no PUT: el backend declara `@Patch(':uuid')` (bug real de wallet-api: PUT daba 404). */
  update(uuid: string, dto: TUpdate): Observable<TResponse> {
    return this._http
      .patch<unknown>(`${this.endpoint}/${uuid}`, dto)
      .pipe(map((raw) => this.parseItem(raw)));
  }

  softDelete(uuid: string): Observable<void> {
    return this._http.delete<void>(`${this.endpoint}/${uuid}`);
  }

  restore(uuid: string): Observable<void> {
    return this._http.patch<void>(`${this.endpoint}/${uuid}/restore`, null);
  }

  /** HEAD — 200 existe, 404 no existe; el 404 es esperado, así que no dispara toast. */
  exists(uuid: string): Observable<boolean> {
    return this._http
      .head(`${this.endpoint}/${uuid}`, { observe: 'response', context: suppressErrorToast() })
      .pipe(
        map((response) => response.status === HttpStatusCode.Ok),
        catchError(() => of(false)),
      );
  }

  reload(): void {
    this.list.reload();
    this.item.reload();
  }
}
