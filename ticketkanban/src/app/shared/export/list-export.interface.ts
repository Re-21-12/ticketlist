/** Una lista ya lista para exportar: encabezados y celdas YA formateadas por la pantalla (fechas, catálogos en español). */
export interface IExportTable {
  /** Título del documento (cabecera del PDF, nombre de la hoja de Excel, primera línea del TXT). */
  title: string;
  /** Nombre base del archivo, sin extensión (p. ej. `usuarios-2026-10-15`). */
  fileName: string;
  headers: readonly string[];
  /** Una fila por registro; un número queda como número en Excel. */
  rows: readonly (readonly (string | number | null)[])[];
}

export type TExportFormat = 'pdf' | 'xlsx' | 'csv' | 'txt';
