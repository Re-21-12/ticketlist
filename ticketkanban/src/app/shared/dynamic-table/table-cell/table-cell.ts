import { Component, computed, input } from '@angular/core';
import type { ITableColumn, TTableRow } from '../dynamic-table.interface';
import { formatCell } from '../utils/cell-format';

/** Una celda: valor formateado según su columna (etiqueta de opción, fecha, Sí/No, «—»). */
@Component({
  selector: 'app-table-cell',
  templateUrl: './table-cell.html',
  styleUrl: './table-cell.css',
})
export class TableCell {
  readonly $row = input.required<TTableRow>();
  readonly $column = input.required<ITableColumn>();

  protected readonly $text = computed(() => formatCell(this.$row(), this.$column()));
  protected readonly $isEmpty = computed(() => this.$text() === '—');
  /**
   * Valores cortos (códigos, fechas, etiquetas) NO se parten: «TCK-001» partido en «TCK-/001» es
   * ilegible. Los textos largos (títulos) sí envuelven, pero solo entre palabras.
   */
  protected readonly $nowrap = computed(
    () => this.$column().dataType !== 'string' || this.$text().length <= 18,
  );
}
