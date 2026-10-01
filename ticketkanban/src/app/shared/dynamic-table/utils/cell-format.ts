import type { ITableColumn, TTableRow } from '../dynamic-table.interface';

const DATE_FORMAT = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Texto a mostrar en una celda: etiqueta de la opción, fecha local, Sí/No, o «—» si está vacío. */
export function formatCell(row: TTableRow, column: ITableColumn): string {
  const value = row[column.field];
  if (value === null || value === undefined || value === '') return '—';

  const option = column.options?.find((o) => o.value === value);
  if (option) return option.label;

  if (value instanceof Date) return DATE_FORMAT.format(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value.toLocaleString('es');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Identificador estable de la fila para `track` / `dataKey` (nunca el índice). */
export function resolveRowId(row: TTableRow, rowIdField = 'uuid'): string {
  return String(row[rowIdField] ?? '');
}
