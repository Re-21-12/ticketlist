import { Component, computed, inject, input, signal } from '@angular/core';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import { firstValueFrom } from 'rxjs';
import { confirmDelete } from '../../shared/confirm/confirm-delete.util';
import { DynamicTable } from '../../shared/dynamic-table/dynamic-table';
import type { TTableRow } from '../../shared/dynamic-table/dynamic-table.interface';
import { FormDialogService } from '../../shared/form-dialog/form-dialog.service';
import { CanPipe } from '../../core/casl/can.pipe';
import {
  CATALOG_CREATE_FORM,
  CATALOG_ITEM_FORM,
  CATALOG_ITEM_SYSTEM_FORM,
  CATALOG_ITEM_TABLE,
  CATALOG_UPDATE_FORM,
} from './catalog-form.config';
import type { TCatalogDetail, TCatalogItem } from './catalog.types';
import { CatalogsService } from './catalogs.service';
import { Illustration } from '../../shared/ui/illustration/illustration';

/**
 * «Catálogos» (tablas dinámicas): listas de valores que administra el equipo. Los de SISTEMA
 * (categoría, prioridad y estado de ticket) conservan sus códigos —los usa el programa— pero su
 * etiqueta y orden se editan. Maestro-detalle: la clave del catálogo abierto vive en la URL (`?key=`).
 */
@Component({
  selector: 'app-catalogs',
  imports: [Illustration, ButtonModule, DynamicTable, CanPipe],
  providers: [DialogService, FormDialogService],
  templateUrl: './catalogs.html',
  styleUrl: './catalogs.css',
})
export class Catalogs {
  /** `?key=` (lo enlaza `withComponentInputBinding`). */
  readonly $key = input<string | undefined>(undefined, { alias: 'key' });

  protected readonly _service = inject(CatalogsService);
  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  protected readonly itemTable = CATALOG_ITEM_TABLE;
  protected readonly $saving = signal(false);

  protected readonly $catalogs = computed(() => {
    const state = this._service.$listState();
    return state.kind === 'success' ? state.data.data : [];
  });
  protected readonly $listLoading = computed(() => this._service.$listState().kind === 'loading');
  protected readonly $listFailed = computed(() => this._service.$listState().kind === 'error');

  /** Detalle del catálogo abierto (con sus elementos), o `null` si no hay uno elegido. */
  protected readonly $detail = computed<TCatalogDetail | null>(() => {
    const state = this._service.$detailState();
    return state.kind === 'success' ? state.data : null;
  });
  protected readonly $detailLoading = computed(() => this._service.$detailState().kind === 'loading');
  protected readonly $items = computed<TTableRow[]>(() => (this.$detail()?.items ?? []) as TTableRow[]);
  /** Una sola página con todos los elementos (un catálogo es corto): sin paginar de servidor. */
  protected readonly $take = computed(() => Math.max(this.$items().length, 5));

  constructor() {
    // El enlace `?key=` manda; sin él se queda lo último elegido en la sesión de la pantalla.
    queueMicrotask(() => this._service.select(this.$key()));
  }

  protected open(key: string): void {
    this._service.select(key);
  }

  // ── Catálogo ─────────────────────────────────────────────────────────────────────────────
  protected onCreateCatalog(): void {
    void this._formDialogService.open({
      header: 'Nuevo catálogo',
      definition: CATALOG_CREATE_FORM,
      initialData: { description: '' },
      submitLabel: 'Crear',
      submitting: this.$saving,
      onSubmit: (dto) =>
        void this.run(async () => {
          const created = await firstValueFrom(this._service.create(dto));
          this._service.select(created.key);
        }, 'Catálogo creado'),
    });
  }

  protected onEditCatalog(detail: TCatalogDetail): void {
    void this._formDialogService.open({
      header: `Editar ${detail.name}`,
      definition: CATALOG_UPDATE_FORM,
      initialData: { name: detail.name, description: detail.description },
      submitting: this.$saving,
      onSubmit: (dto) =>
        void this.run(() => firstValueFrom(this._service.update(detail.key, dto)), 'Catálogo actualizado'),
    });
  }

  protected onDeleteCatalog(detail: TCatalogDetail): void {
    confirmDelete(this._confirmationService, {
      header: 'Eliminar catálogo',
      message: `¿Eliminar el catálogo «${detail.name}» con sus ${detail.itemCount} elementos?`,
      accept: () =>
        void this.run(async () => {
          await firstValueFrom(this._service.remove(detail.key));
          this._service.select(undefined);
        }, 'Catálogo eliminado'),
    });
  }

  // ── Elementos ────────────────────────────────────────────────────────────────────────────
  protected onCreateItem(): void {
    const detail = this.$detail();
    if (!detail) return;
    void this._formDialogService.open({
      header: `Nuevo elemento · ${detail.name}`,
      definition: CATALOG_ITEM_FORM,
      initialData: { order: (detail.items.length + 1) * 10, active: true, icon: '', severity: '' },
      submitLabel: 'Crear',
      submitting: this.$saving,
      onSubmit: (dto) =>
        void this.run(() => firstValueFrom(this._service.createItem(detail.key, dto)), 'Elemento creado'),
    });
  }

  protected onEditItem(row: TTableRow): void {
    const detail = this.$detail();
    const item = row as TCatalogItem;
    if (!detail) return;
    void this._formDialogService.open({
      header: `Editar ${item.label}`,
      definition: item.system ? CATALOG_ITEM_SYSTEM_FORM : CATALOG_ITEM_FORM,
      initialData: {
        code: item.code,
        label: item.label,
        icon: item.icon ?? '',
        severity: item.severity ?? '',
        order: item.order,
        active: item.active,
      },
      submitting: this.$saving,
      onSubmit: (dto) =>
        void this.run(
          () => firstValueFrom(this._service.updateItem(detail.key, item.uuid, dto)),
          'Elemento actualizado',
        ),
    });
  }

  protected onDeleteItem(row: TTableRow): void {
    const detail = this.$detail();
    const item = row as TCatalogItem;
    if (!detail) return;
    confirmDelete(this._confirmationService, {
      header: 'Eliminar elemento',
      message: `¿Eliminar «${item.label}» (${item.code}) de ${detail.name}?`,
      accept: () =>
        void this.run(() => firstValueFrom(this._service.removeItem(detail.key, item.uuid)), 'Elemento eliminado'),
    });
  }

  private async run(request: () => Promise<unknown>, summary: string): Promise<void> {
    this.$saving.set(true);
    try {
      await request();
      this._formDialogService.close();
      this._service.reload();
      this._messageService.add({ severity: 'success', summary, life: 3000 });
    } catch {
      // El toast del error lo muestra errorInterceptor; el modal queda abierto para reintentar.
    } finally {
      this.$saving.set(false);
    }
  }
}
