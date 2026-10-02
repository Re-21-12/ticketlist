import { Component, input } from '@angular/core';
import { Illustration } from '../../ui/illustration/illustration';

/** Estado vacío de la tabla (ocupa todo el ancho vía colspan en el padre). */
@Component({
  selector: 'app-table-empty-state',
  imports: [Illustration],
  templateUrl: './table-empty-state.html',
  styleUrl: './table-empty-state.css',
})
export class TableEmptyState {
  readonly $message = input('Sin información disponible');
}
