import type { IExportTable, TExportFormat } from './list-export.interface';

/**
 * Exportar una lista a PDF, Excel, CSV o texto (reportes). Cada librería se carga RECIÉN al elegir su formato
 * (`import()` dinámico): jsPDF y ExcelJS (~1 MB) no pesan en la carga inicial de la app.
 */
const MIME: Record<TExportFormat, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
};

const cell = (value: string | number | null): string => (value === null ? '' : String(value));
const quote = (text: string): string => (/[",\n\r;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);

/** CSV con BOM (Excel abre bien las tildes) y comillas donde hace falta. */
export function toCsv(table: IExportTable): Blob {
  const lines = [table.headers, ...table.rows].map((row) => row.map((value) => quote(cell(value))).join(','));
  return new Blob(['﻿' + lines.join('\r\n')], { type: MIME.csv });
}

/** Texto plano con columnas alineadas, para pegar en un mensaje. */
export function toTxt(table: IExportTable): Blob {
  const all = [table.headers, ...table.rows].map((row) => row.map(cell));
  const widths = table.headers.map((_, i) => Math.max(...all.map((row) => (row[i] ?? '').length)));
  const line = (row: string[]): string =>
    row
      .map((text, i) => text.padEnd(widths[i] ?? 0))
      .join('  ')
      .trimEnd();
  const rule = widths.map((width) => '-'.repeat(width)).join('  ');
  const body = [table.title, '', line(all[0] ?? []), rule, ...all.slice(1).map(line)].join('\n');
  return new Blob([body + '\n'], { type: MIME.txt });
}

/** Color de marca del tema activo como [r, g, b] (el que la persona eligió en Apariencia). */
function brandRgb(): [number, number, number] {
  const probe = document.createElement('span');
  probe.style.color = 'var(--app-primary)';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
  probe.remove();
  return [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
}

/** Excel real (.xlsx): encabezado en el color de marca, números como números, ancho según el contenido. */
export async function toXlsx(table: IExportTable): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  const sheet = book.addWorksheet(table.title.slice(0, 31));
  const argb = `FF${brandRgb()
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
  const head = sheet.addRow([...table.headers]);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  });
  for (const row of table.rows) sheet.addRow([...row]);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(table.headers[i]?.length ?? 0, ...table.rows.map((row) => cell(row[i] ?? null).length));
    column.width = Math.min(60, Math.max(10, longest + 2));
  });
  return new Blob([await book.xlsx.writeBuffer()], { type: MIME.xlsx });
}

/**
 * PDF con el diseño de la app: franja en el color de MARCA, título y fecha de generación, encabezados de columna en un
 * tono suave de la marca, filas en cebra (como la grilla) y «Página n de m».
 */
export async function toPdf(table: IExportTable): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const [r, g, b] = brandRgb();
  const tint = (v: number): number => Math.round(v + (255 - v) * 0.88); // 12 % de la marca sobre blanco
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const width = pageWidth - margin * 2;
  const bottom = pageHeight - margin - 16;
  const colWidth = width / Math.max(1, table.headers.length);
  const rowHeight = 20;
  const generated = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  let y = 0;

  const drawCells = (values: readonly (string | number | null)[]): void => {
    doc.setFontSize(9);
    values.forEach((value, i) => {
      const line = (doc.splitTextToSize(cell(value), colWidth - 8) as string[])[0] ?? '';
      doc.text(line, margin + i * colWidth + 4, y);
    });
  };
  const header = (): void => {
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, pageWidth, 56, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(table.title, margin, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Generado el ${generated}`, pageWidth - margin, 34, { align: 'right' });
    y = 80;
    doc.setFillColor(tint(r), tint(g), tint(b));
    doc.rect(margin, y - 14, width, rowHeight, 'F');
    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    drawCells(table.headers);
    y += rowHeight;
  };

  header();
  table.rows.forEach((row, index) => {
    if (y > bottom) {
      doc.addPage();
      header();
    }
    if (index % 2 === 1) {
      doc.setFillColor(246, 246, 246);
      doc.rect(margin, y - 14, width, rowHeight, 'F');
    }
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'normal');
    drawCells(row);
    y += rowHeight;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
    doc.text(`${table.rows.length} registros`, margin, pageHeight - 20);
  }
  return doc.output('blob');
}

export const fileNameFor = (table: IExportTable, format: TExportFormat): string => `${table.fileName}.${format}`;

export function downloadFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fecha local `AAAA-MM-DD` para el nombre del archivo. */
export function stamp(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
