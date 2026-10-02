import { HttpClient, httpResource } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { CatalogOptionsService } from '../../shared/catalog-options/catalog-options.service';
import { mapResourceState } from '../../core/interfaces/async-state.types';
import {
  CatalogDetailSchema,
  CatalogItemSchema,
  CatalogListSchema,
  CatalogSummarySchema,
} from './catalog.schema';
import type {
  TCatalogCreate,
  TCatalogDetail,
  TCatalogItem,
  TCatalogItemUpsert,
  TCatalogSummary,
  TCatalogUpdate,
} from './catalog.types';

const BASE = '/api/catalogs';

/**
 * Acceso HTTP de `/api/catalogs`. Maestro-detalle: la lista de catálogos y el catálogo elegido
 * (con sus elementos). Las mutaciones devuelven `Observable` (la página recarga al terminar).
 */
@Service()
export class CatalogsService {
  private readonly _http = inject(HttpClient);
  private readonly _options = inject(CatalogOptionsService);

  /** Clave del catálogo abierto; `undefined` deja el detalle en reposo. */
  readonly $selectedKey = signal<string | undefined>(undefined);

  readonly list = httpResource(() => BASE, { parse: (raw) => CatalogListSchema.parse(raw) });
  readonly detail = httpResource(
    () => {
      const key = this.$selectedKey();
      return key ? `${BASE}/${key}` : undefined;
    },
    { parse: (raw) => CatalogDetailSchema.parse(raw) },
  );

  readonly $listState = computed(() => mapResourceState(this.list.status(), this.list.value(), this.list.error()));
  readonly $detailState = computed(() =>
    mapResourceState<TCatalogDetail>(this.detail.status(), this.detail.value(), this.detail.error()),
  );

  select(key: string | undefined): void {
    this.$selectedKey.set(key);
  }

  /** Tras editar un catálogo, los formularios que ya lo usan (tickets) vuelven a pedir sus opciones. */
  reload(): void {
    this.list.reload();
    this.detail.reload();
    this._options.reloadAll();
  }

  create(dto: TCatalogCreate): Observable<TCatalogSummary> {
    return this._http.post<unknown>(BASE, dto).pipe(map((raw) => CatalogSummarySchema.parse(raw)));
  }

  update(key: string, dto: TCatalogUpdate): Observable<TCatalogSummary> {
    return this._http.patch<unknown>(`${BASE}/${key}`, dto).pipe(map((raw) => CatalogSummarySchema.parse(raw)));
  }

  remove(key: string): Observable<void> {
    return this._http.delete<void>(`${BASE}/${key}`);
  }

  createItem(key: string, dto: TCatalogItemUpsert): Observable<TCatalogItem> {
    return this._http.post<unknown>(`${BASE}/${key}/items`, dto).pipe(map((raw) => CatalogItemSchema.parse(raw)));
  }

  updateItem(key: string, uuid: string, dto: TCatalogItemUpsert): Observable<TCatalogItem> {
    return this._http
      .patch<unknown>(`${BASE}/${key}/items/${uuid}`, dto)
      .pipe(map((raw) => CatalogItemSchema.parse(raw)));
  }

  removeItem(key: string, uuid: string): Observable<void> {
    return this._http.delete<void>(`${BASE}/${key}/items/${uuid}`);
  }
}
