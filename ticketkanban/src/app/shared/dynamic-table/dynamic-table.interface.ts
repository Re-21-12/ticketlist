import type { TSubjects } from '../../core/casl/casl.types';

export type TTableRow = Record<string, unknown>;

/** Acciones estándar por fila; «editar» y «eliminar» además exigen el permiso CASL sobre la fila. */
export type TTableAction = 'view' | 'update' | 'delete';

export interface ITableColumn {
  field: string;
  header: string;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
  /** value → label (p. ej. enums del contrato): la celda muestra la etiqueta, no el valor crudo. */
  options?: { value: string | number; label: string }[];
}

export interface ITablePage {
  page: number;
  take: number;
}

/** Config de `app-dynamic-table` (lo que cambia por pantalla). */
export interface ITableConfig {
  /** Título accesible de la tabla (`<caption>` / `aria-label`). */
  caption: string;
  columns: ITableColumn[];
  /** Subject CASL: decide Nuevo (create) y, por fila, Editar (update) / Eliminar (delete). */
  subject: TSubjects;
  /** Campo identificador de la fila (default `uuid`, como el BaseEntity del backend). */
  rowIdField?: string;
  actions?: TTableAction[];
  rowsPerPageOptions?: number[];
  /** Texto del botón de alta (default «Nuevo»). */
  createLabel?: string;
}
