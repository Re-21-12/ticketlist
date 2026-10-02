import { Component, input, output } from '@angular/core';
import type { TSubjects } from '../../../core/casl/casl.types';
import type { ITableColumn, TTableAction, TTableRow } from '../dynamic-table.interface';
import { RowActions } from '../row-actions/row-actions';
import { TableCell } from '../table-cell/table-cell';

/**
 * Vista MOBILE de una fila (port de `TableRowCard` de wallet-api). Vive en un `<td>` extra de la
 * misma fila; qué versión se ve (celdas o card) lo decide una media query en
 * dynamic-table.css, no JS. Lista TODAS las columnas apiladas: en una card no hay scroll
 * horizontal que evitar.
 */
@Component({
  selector: 'app-table-row-card',
  imports: [TableCell, RowActions],
  templateUrl: './table-row-card.html',
  styleUrl: './table-row-card.css',
})
export class TableRowCard {
  readonly $row = input.required<TTableRow>();
  readonly $columns = input.required<ITableColumn[]>();
  readonly $subject = input.required<TSubjects>();
  readonly $actions = input<TTableAction[]>(['view', 'update', 'delete']);
  readonly $rowLabel = input('');
  readonly $busy = input(false);
  readonly $deleteLabel = input('Eliminar');
  readonly $allow = input<(action: TTableAction, row: TTableRow) => boolean>(() => true);

  readonly $view = output<TTableRow>();
  readonly $edit = output<TTableRow>();
  readonly $delete = output<TTableRow>();
}
