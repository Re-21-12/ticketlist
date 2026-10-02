import type { ITableColumn, TTableRow } from '../dynamic-table.interface';

const DATE_FORMAT = new Intl.DateTimeFormat('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATETIME_FORMAT = new Intl.DateTimeFormat('es', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/** Texto a mostrar en una celda: etiqueta de la opción, fecha local, Sí/No, o «—» si está vacío. */
export function formatCell(row: TTableRow, column: ITableColumn): string {
  const value = row[column.field];
  if (value === null || value === undefined || value === '') return '—';

  const option = column.options?.find((o) => o.value === value);
  if (option) return option.label;

  if (value instanceof Date) return (column.dataType === 'datetime' ? DATETIME_FORMAT : DATE_FORMAT).format(value);
  // Marca de tiempo ISO tal como llega por HTTP (auditoría, altas): se muestra en hora local.
  if (typeof value === 'string' && (column.dataType === 'datetime' || column.dataType === 'date') && ISO_INSTANT.test(value)) {
    const instant = new Date(value);
    if (!Number.isNaN(instant.getTime())) {
      return (column.dataType === 'datetime' ? DATETIME_FORMAT : DATE_FORMAT).format(instant);
    }
  }
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value.toLocaleString('es');
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Identificador estable de la fila para `track` / `dataKey` (nunca el índice). */
export function resolveRowId(row: TTableRow, rowIdField = 'uuid'): string {
  return String(row[rowIdField] ?? '');
}
