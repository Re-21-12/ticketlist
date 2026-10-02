import type { TSubjects } from '../../core/casl/casl.types';
import type { TBadgeSeverity } from '../ui/badge/badge.types';

export type TTableRow = Record<string, unknown>;

/** Acciones estándar por fila; «editar» y «eliminar» además exigen el permiso CASL sobre la fila. */
export type TTableAction = 'view' | 'update' | 'delete';

export interface ITableColumn {
  field: string;
  header: string;
  dataType?: 'string' | 'number' | 'boolean' | 'date' | 'datetime';
  /** value → label (p. ej. enums del contrato): la celda muestra la etiqueta, no el valor crudo. Si trae `icon`/`severity`, con `badge` se pinta como insignia. */
  options?: { value: string | number; label: string; icon?: string | null; severity?: TBadgeSeverity | null }[];
  /** Insignia armada con campos de la MISMA fila (catálogos: etiqueta + `icon` + `severity` de cada elemento). */
  badgeFrom?: { icon?: string; severity?: string };
  /** Un booleano donde `true` es lo MALO (cuenta bloqueada, deshabilitada): «Sí» sale en rojo, «No» en neutro. */
  dangerWhenTrue?: boolean;
  /** El valor es una clase de PrimeIcons: la celda muestra el ícono junto al texto. */
  iconValue?: boolean;
  /** Pinta el valor como insignia (texto + ícono + color de su opción). Sin opción que coincida, cae al texto. */
  badge?: boolean;
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
  /** Campo que nombra la fila en los botones accesibles («Editar {nombre}»); por defecto `code`, luego el id. */
  rowLabelField?: string;
  actions?: TTableAction[];
  rowsPerPageOptions?: number[];
  /** Veto por fila además del permiso CASL: `false` esconde esa acción en esa fila. */
  rowActionAllowed?: (action: TTableAction, row: TTableRow) => boolean;
  /** Texto del botón de borrado (default «Eliminar»); p. ej. «Revocar» cuando borrar = revocar. */
  deleteLabel?: string;
  /** `false` oculta «Nuevo» aunque el rol pueda crear (recursos que no se dan de alta a mano: usuarios, auditoría). */
  creatable?: boolean;
  /** Texto del botón de alta (default «Nuevo»). */
  createLabel?: string;
}
