import { Component, computed, inject, input, output } from '@angular/core';
import { AbilityServiceSignal } from '@casl/angular';
import { SkeletonModule } from '@openng/optimus-ui/skeleton';
import { TableModule } from '@openng/optimus-ui/table';
import type { TableLazyLoadEvent } from '@openng/optimus-ui/types/table';
import type { AppAbility } from '../../core/casl/casl.types';
import type { ITableConfig, ITablePage, TTableAction, TTableRow } from './dynamic-table.interface';
import { RowActions } from './row-actions/row-actions';
import { TableCell } from './table-cell/table-cell';
import { TableEmptyState } from './table-empty-state/table-empty-state';
import { TableRowCard } from './table-row-card/table-row-card';
import { TableToolbar } from './table-toolbar/table-toolbar';
import { resolveRowId } from './utils/cell-format';

let nextTableId = 0;

/**
 * Tabla dinámica (port reducido de `DynamicTable` de wallet-api):
 *  - Columnas desde la config de campos (`buildTableColumns`), paginación y búsqueda de SERVIDOR
 *    (encaja con `BaseApiAbstract.list`: el padre llama `setPage`/`setSearch`).
 *  - Desktop: filas con celdas; mobile: la MISMA fila muestra una card (`app-table-row-card`),
 *    decidido por media query en CSS, sin detectar viewport en JS.
 *  - Permisos CASL: «Nuevo» con `create`; por fila, Editar/Eliminar con la instancia (condiciones).
 *  - NO abre diálogos ni llama al backend: emite y el padre decide (con `FormDialogService`).
 */
@Component({
  selector: 'app-dynamic-table',
  imports: [TableModule, SkeletonModule, TableToolbar, TableCell, RowActions, TableRowCard, TableEmptyState],
  templateUrl: './dynamic-table.html',
  styleUrl: './dynamic-table.css',
})
export class DynamicTable {
  private readonly _abilityService = inject<AbilityServiceSignal<AppAbility>>(AbilityServiceSignal);
  protected readonly tableId = `dynamic-table-${nextTableId++}`;

  readonly $config = input.required<ITableConfig>();
  readonly $rows = input<TTableRow[]>([]);
  readonly $totalRecords = input(0);
  readonly $page = input(1);
  readonly $take = input(10);
  readonly $loading = input(false);
  readonly $busy = input(false);

  readonly $pageChange = output<ITablePage>();
  readonly $searchChange = output<string>();
  readonly $create = output<void>();
  readonly $refresh = output<void>();
  readonly $view = output<TTableRow>();
  readonly $edit = output<TTableRow>();
  readonly $delete = output<TTableRow>();

  protected readonly $canCreate = computed(() =>
    this._abilityService.can('create', this.$config().subject),
  );
  protected readonly $actions = computed<TTableAction[]>(
    () => this.$config().actions ?? ['view', 'update', 'delete'],
  );
  protected readonly $rowIdField = computed(() => this.$config().rowIdField ?? 'uuid');
  /** Índice absoluto de la primera fila de la página (p-table trabaja con `first`, 0-based). */
  protected readonly $first = computed(() => (this.$page() - 1) * this.$take());
  /** # + columnas + acciones (colspan del estado vacío y de la card mobile). */
  protected readonly $colspan = computed(() => this.$config().columns.length + 2);
  protected readonly $skeletonRows = computed(() => Array.from({ length: Math.min(this.$take(), 5) }, (_, i) => i));

  protected rowLabel(row: TTableRow): string {
    return String(row['code'] ?? row[this.$rowIdField()] ?? '');
  }

  protected readonly rowTrackBy = (_: number, row: TTableRow): string =>
    resolveRowId(row, this.$rowIdField());

  protected onLazyLoad(event: TableLazyLoadEvent): void {
    const take = event.rows ?? this.$take();
    const page = Math.floor((event.first ?? 0) / take) + 1;
    if (page !== this.$page() || take !== this.$take()) this.$pageChange.emit({ page, take });
  }
}
