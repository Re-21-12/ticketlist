import { Component, input } from '@angular/core';

/** Estado vacío de la tabla (ocupa todo el ancho vía colspan en el padre). */
@Component({
  selector: 'app-table-empty-state',
  templateUrl: './table-empty-state.html',
  styleUrl: './table-empty-state.css',
})
export class TableEmptyState {
  readonly $message = input('Sin información disponible');
}
