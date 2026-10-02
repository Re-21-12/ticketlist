import type { Observable } from 'rxjs';
import type { Signal } from '@angular/core';
import type { z } from 'zod';
import type { TAsyncState } from '../../core/interfaces/async-state.types';
import type { IPaginatedResult } from '../../core/interfaces/paginated-result.interface';
import type { IFieldOption } from '../dynamic-form/field-config.interface';
import type { IFormDefinition } from '../dynamic-form/form-definition.interface';
import type { ITableConfig, TTableRow } from '../dynamic-table/dynamic-table.interface';

/**
 * Lo que `app-crud-page` necesita de un servicio de recurso (lo cumple cualquier `BaseApiAbstract`).
 * Se declara con sintaxis de MÉTODO a propósito: es bivariante y deja pasar un servicio tipado
 * (`BaseApiAbstract<TMenuItem, …>`) donde aquí se habla de filas genéricas.
 */
export interface ICrudService {
  readonly $listState: Signal<TAsyncState<IPaginatedResult<TTableRow>>>;
  readonly $pagination: Signal<{ page: number; take: number }>;
  setPage(page: number): void;
  setTake(take: number): void;
  setSearch(search: string): void;
  reload(): void;
  create(dto: never): Observable<unknown>;
  update(uuid: string, dto: never): Observable<unknown>;
  softDelete(uuid: string): Observable<void>;
}

/** Lo que cambia por recurso. Todo lo demás (tabla, modal, confirmación, avisos) es de `app-crud-page`. */
export interface ICrudConfig<TSchema extends z.ZodObject = z.ZodObject> {
  /** Sustantivo en minúsculas para los avisos: «permiso», «ítem de menú». */
  entity: string;
  /** Artículo y género del sustantivo para los mensajes («el»/«la»). */
  article: 'el' | 'la';
  table: ITableConfig;
  form: IFormDefinition<TSchema>;
  /** Cómo se llama una fila en el encabezado del modal y en los avisos. */
  rowName: (row: TTableRow) => string;
  /** Valores iniciales del alta (los defaults del schema ya aplican; esto es para lo demás). */
  createDefaults?: Partial<z.input<TSchema>>;
  /** Fila del servidor → valores del formulario (p. ej. `null` → `''` en campos de texto). Por defecto, la fila tal cual. */
  toFormValue?: (row: TTableRow) => Record<string, unknown>;
  /** Opciones de selects que llegan en runtime. */
  optionsByField?: () => Record<string, IFieldOption[]>;
  /** Verbo del borrado cuando no es «Eliminar» (p. ej. «Revocar»): botón, confirmación y aviso («Relación revocada»). */
  deleteVerb?: { label: string; stem: string };
  /** Mensaje de la confirmación de borrado; por defecto «¿Eliminar {rowName}?». */
  deleteMessage?: (row: TTableRow) => string;
}
