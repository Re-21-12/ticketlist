import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { SelectModule } from '@openng/optimus-ui/select';
import type { ITicketFilters } from '../ticket-filter.util';
import { TicketsStore } from '../tickets.store';

/** Un desplegable de filtro: qué criterio cambia, su rótulo y sus opciones (con ícono y color del catálogo). */
interface IFilterSelect {
  key: 'department' | 'priority' | 'type' | 'category' | 'status';
  label: string;
  options: { value: string | number; label: string; icon?: string | null }[];
}

/**
 * Filtros de búsqueda de tickets. Los criterios viven en `TicketsStore` (los comparten el tablero —que filtra
 * en el cliente— y el listado —que los envía al servidor—). En el listado no se pinta la búsqueda de texto ni los
 * filtros que el backend no sabe aplicar («solo mis tickets», «fuera de SLA»): esa búsqueda ya está en la tabla.
 */
@Component({
  selector: 'app-ticket-filters',
  imports: [FormsModule, ButtonModule, InputTextModule, SelectModule],
  templateUrl: './ticket-filters.html',
  styleUrl: './ticket-filters.css',
})
export class TicketFilters {
  protected readonly _ticketsStore = inject(TicketsStore);

  readonly $mode = input<'board' | 'list'>('board');

  protected readonly $selects = computed<IFilterSelect[]>(() => [
    { key: 'department', label: 'Departamento', options: this._ticketsStore.$departmentOptions() },
    { key: 'priority', label: 'Urgencia', options: this._ticketsStore.$priorityOptions() },
    { key: 'type', label: 'Tipo', options: this._ticketsStore.$typeOptions() },
    { key: 'category', label: 'Categoría', options: this._ticketsStore.$categoryOptions() },
    { key: 'status', label: 'Estado', options: this._ticketsStore.$statusOptions() },
  ]);

  protected set(key: keyof ITicketFilters, value: unknown): void {
    this._ticketsStore.setFilters({ [key]: value ?? (typeof this._ticketsStore.$filters()[key] === 'boolean' ? false : '') });
  }
}
