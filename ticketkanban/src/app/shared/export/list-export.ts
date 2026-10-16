import { Component, computed, input, signal } from '@angular/core';
import type { MenuItem } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { MenuModule } from '@openng/optimus-ui/menu';
import type { IExportTable, TExportFormat } from './list-export.interface';
import { downloadFile, fileNameFor, toCsv, toPdf, toTxt, toXlsx } from './list-export.util';

/**
 * «Exportar» de un listado o reporte: PDF, Excel, CSV y texto. La pantalla entrega la tabla YA formateada (`$table`, o
 * una función `$source` si hay que pedir todas las filas al servidor) y este botón solo arma el archivo y lo descarga.
 */
@Component({
  selector: 'app-list-export',
  imports: [ButtonModule, MenuModule],
  templateUrl: './list-export.html',
  styleUrl: './list-export.css',
})
export class ListExport {
  /** Tabla ya armada (reportes con los datos en pantalla). */
  readonly $table = input<IExportTable | null>(null);
  /** Alternativa perezosa: arma la tabla al exportar (p. ej. pide TODAS las filas, no solo la página). */
  readonly $source = input<(() => Promise<IExportTable>) | null>(null);
  readonly $label = input('Exportar');
  readonly $disabled = input(false);

  protected readonly $busy = signal(false);

  protected readonly $items = computed<MenuItem[]>(() => [
    { label: 'PDF', icon: 'pi pi-file-pdf', command: () => void this.export('pdf') },
    { label: 'Excel', icon: 'pi pi-file-excel', command: () => void this.export('xlsx') },
    { label: 'CSV', icon: 'pi pi-file', command: () => void this.export('csv') },
    { label: 'Texto', icon: 'pi pi-align-left', command: () => void this.export('txt') },
  ]);

  async export(format: TExportFormat): Promise<void> {
    this.$busy.set(true);
    try {
      const source = this.$source();
      const table = source ? await source() : this.$table();
      if (!table) return;
      const blob = format === 'pdf' ? await toPdf(table) : format === 'xlsx' ? await toXlsx(table) : format === 'csv' ? toCsv(table) : toTxt(table);
      downloadFile(blob, fileNameFor(table, format));
    } catch {
      // `errorInterceptor` avisa si fue la red; un fallo local deja el botón libre para reintentar.
    } finally {
      this.$busy.set(false);
    }
  }
}
