import type { IExportTable } from '../../export/list-export.interface';
import { stamp } from '../../export/list-export.util';
import type { ITableColumn, TTableRow } from '../dynamic-table.interface';
import { formatCell } from './cell-format';

/** Tabla lista para exportar a partir de las columnas y las filas de una `app-dynamic-table` (mismo texto que la celda). */
export function buildExportTable(title: string, columns: readonly ITableColumn[], rows: readonly TTableRow[], now = new Date()): IExportTable {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return {
    title,
    fileName: `${slug || 'reporte'}-${stamp(now)}`,
    headers: columns.map((column) => column.header),
    rows: rows.map((row) => columns.map((column) => formatCell(row, column))),
  };
}
