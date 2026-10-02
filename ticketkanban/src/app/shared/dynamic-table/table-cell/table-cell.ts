import { Component, computed, input } from '@angular/core';
import { Badge } from '../../ui/badge/badge';
import type { TBadgeSeverity } from '../../ui/badge/badge.types';
import type { ITableColumn, TTableRow } from '../dynamic-table.interface';
import { formatCell } from '../utils/cell-format';

/** Una celda: valor formateado según su columna (etiqueta de opción, insignia, fecha, Sí/No, «—»). */
@Component({
  selector: 'app-table-cell',
  imports: [Badge],
  templateUrl: './table-cell.html',
  styleUrl: './table-cell.css',
})
export class TableCell {
  readonly $row = input.required<TTableRow>();
  readonly $column = input.required<ITableColumn>();

  protected readonly $text = computed(() => formatCell(this.$row(), this.$column()));
  protected readonly $isEmpty = computed(() => this.$text() === '—');
  /** La opción que coincide con el valor, si la columna se pinta como insignia. */
  protected readonly $badge = computed(() => {
    const column = this.$column();
    const row = this.$row();
    const value = row[column.field];
    if (column.badgeFrom) {
      const { icon, severity } = column.badgeFrom;
      return {
        label: this.$text(),
        icon: icon ? ((row[icon] as string | null) ?? null) : null,
        severity: severity ? ((row[severity] as TBadgeSeverity | null) ?? null) : null,
      };
    }
    if (typeof value === 'boolean' && !column.badge) {
      // Sí / No como insignia: el texto va siempre; el color y el ícono refuerzan.
      if (column.dangerWhenTrue) {
        return value
          ? { label: 'Sí', icon: 'pi-lock', severity: 'danger' as TBadgeSeverity }
          : { label: 'No', icon: 'pi-minus', severity: 'secondary' as TBadgeSeverity };
      }
      return value
        ? { label: 'Sí', icon: 'pi-check', severity: 'success' as TBadgeSeverity }
        : { label: 'No', icon: 'pi-minus', severity: 'secondary' as TBadgeSeverity };
    }
    if (!column.badge) return null;
    return column.options?.find((option) => option.value === value) ?? null;
  });
  /** Clase del ícono cuando la columna ES un ícono (`pi-bars` → «pi pi-bars»). */
  protected readonly $iconClass = computed(() => {
    const value = this.$row()[this.$column().field];
    return this.$column().iconValue && typeof value === 'string' && value ? `pi ${value}` : null;
  });
  /**
   * Valores cortos (códigos, fechas, etiquetas) NO se parten: «TCK-001» partido en «TCK-/001» es
   * ilegible. Los textos largos (títulos) sí envuelven, pero solo entre palabras.
   */
  protected readonly $nowrap = computed(
    () => this.$column().dataType !== 'string' || this.$text().length <= 18,
  );
}
