import { Component, DestroyRef, inject, input, output } from '@angular/core';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Barra superior de la tabla: búsqueda (con debounce, va al BACKEND vía `setSearch` del
 * servicio), refrescar y alta. «Nuevo» solo aparece si la sesión puede crear (lo calcula el padre).
 */
@Component({
  selector: 'app-table-toolbar',
  imports: [ButtonModule, InputTextModule],
  templateUrl: './table-toolbar.html',
  styleUrl: './table-toolbar.css',
})
export class TableToolbar {
  private readonly _destroyRef = inject(DestroyRef);
  private _searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly $searchId = input.required<string>();
  readonly $canCreate = input(false);
  readonly $createLabel = input('Nuevo');
  readonly $refreshing = input(false);

  readonly $searchChange = output<string>();
  readonly $create = output<void>();
  readonly $refresh = output<void>();

  constructor() {
    this._destroyRef.onDestroy(() => this.clearTimer());
  }

  protected onSearchInput(value: string): void {
    this.clearTimer();
    this._searchTimer = setTimeout(() => this.$searchChange.emit(value), SEARCH_DEBOUNCE_MS);
  }

  private clearTimer(): void {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = null;
  }
}
