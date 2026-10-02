import { Component, computed, inject, input, signal } from '@angular/core';
import { Illustration } from '../ui/illustration/illustration';
import type { TIllustration } from '../ui/illustration/illustration.types';
import { firstValueFrom } from 'rxjs';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { DialogService } from '@openng/optimus-ui/dynamicdialog';
import type { z } from 'zod';
import { confirmDelete } from '../confirm/confirm-delete.util';
import { DynamicTable } from '../dynamic-table/dynamic-table';
import type { ITablePage, TTableRow } from '../dynamic-table/dynamic-table.interface';
import { FormDialogService } from '../form-dialog/form-dialog.service';
import type { ICrudConfig, ICrudService } from './crud-page.interface';

/**
 * Pantalla CRUD completa y reutilizable: encabezado + `app-dynamic-table` (paginación y búsqueda de
 * servidor, cards en móvil, permisos CASL por fila) + modal dinámico para alta/edición/vista +
 * confirmación de borrado + avisos. Una página nueva de administración es solo
 * `<app-crud-page [$service]="…" [$config]="…" />` con su servicio y su `*-form.config.ts`.
 *
 * Errores del backend (400/404/409…) los muestra `errorInterceptor`; el modal queda abierto con los
 * datos para corregir y reintentar.
 */
@Component({
  selector: 'app-crud-page',
  imports: [Illustration, DynamicTable],
  providers: [DialogService, FormDialogService],
  templateUrl: './crud-page.html',
  styleUrl: './crud-page.css',
})
export class CrudPage {
  readonly $heading = input.required<string>();
  readonly $description = input<string>('');
  /** Escena decorativa del encabezado (opcional). */
  readonly $illustration = input<TIllustration | null>(null);
  readonly $service = input.required<ICrudService>();
  readonly $config = input.required<ICrudConfig>();

  private readonly _formDialogService = inject(FormDialogService);
  private readonly _messageService = inject(MessageService);
  private readonly _confirmationService = inject(ConfirmationService);

  protected readonly $saving = signal(false);

  private readonly $_state = computed(() => this.$service().$listState());
  protected readonly $rows = computed<TTableRow[]>(() => {
    const state = this.$_state();
    return state.kind === 'success' ? state.data.data : [];
  });
  protected readonly $total = computed(() => {
    const state = this.$_state();
    return state.kind === 'success' ? state.data.meta.total : 0;
  });
  protected readonly $loading = computed(() => this.$_state().kind === 'loading');
  protected readonly $failed = computed(() => this.$_state().kind === 'error');

  protected onPage({ page, take }: ITablePage): void {
    this.$service().setPage(page);
    this.$service().setTake(take);
  }

  protected onCreate(): void {
    const config = this.$config();
    void this._formDialogService.open({
      header: `Nuev${config.article === 'la' ? 'a' : 'o'} ${config.entity}`,
      definition: config.form,
      initialData: config.createDefaults ?? null,
      submitLabel: 'Crear',
      submitting: this.$saving,
      ...(config.optionsByField ? { optionsByField: config.optionsByField } : {}),
      onSubmit: (value) =>
        void this.save(() => firstValueFrom(this.$service().create(value as never)), this.done('cread')),
    });
  }

  protected onEdit(row: TTableRow): void {
    const config = this.$config();
    void this._formDialogService.open({
      header: `Editar ${config.rowName(row)}`,
      definition: config.form,
      initialData: this.formValue(row),
      submitting: this.$saving,
      ...(config.optionsByField ? { optionsByField: config.optionsByField } : {}),
      onSubmit: (value) =>
        void this.save(
          () => firstValueFrom(this.$service().update(String(row['uuid']), value as never)),
          this.done('actualizad'),
        ),
    });
  }

  protected onView(row: TTableRow): void {
    const config = this.$config();
    void this._formDialogService.open({
      header: config.rowName(row),
      definition: config.form,
      initialData: this.formValue(row),
      readonlyMode: true,
      submitting: () => false,
      onSubmit: () => undefined,
      ...(config.optionsByField ? { optionsByField: config.optionsByField } : {}),
    });
  }

  protected onDelete(row: TTableRow): void {
    const config = this.$config();
    const name = config.rowName(row);
    confirmDelete(this._confirmationService, {
      header: `${config.deleteVerb?.label ?? 'Eliminar'} ${config.entity}`,
      acceptLabel: config.deleteVerb?.label,
      message: config.deleteMessage?.(row) ?? `¿Eliminar ${config.article} ${config.entity} «${name}»?`,
      accept: () => void this.remove(String(row['uuid']), name),
    });
  }

  private formValue(row: TTableRow): Partial<z.input<z.ZodObject>> {
    const toFormValue = this.$config().toFormValue;
    return (toFormValue ? toFormValue(row) : row) as Partial<z.input<z.ZodObject>>;
  }

  /** «Permiso creado» / «Relación creada»: sustantivo con mayúscula + participio concordado. */
  private done(stem: string): string {
    const { entity, article } = this.$config();
    return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} ${stem}${article === 'la' ? 'a' : 'o'}`;
  }

  private async remove(uuid: string, name: string): Promise<void> {
    this.$saving.set(true);
    try {
      await firstValueFrom(this.$service().softDelete(uuid));
      this.$service().reload();
      this._messageService.add({ severity: 'success', summary: this.done(this.$config().deleteVerb?.stem ?? 'eliminad'), detail: name });
    } catch {
      // El toast del error lo muestra errorInterceptor.
    } finally {
      this.$saving.set(false);
    }
  }

  private async save(request: () => Promise<unknown>, summary: string): Promise<void> {
    this.$saving.set(true);
    try {
      await request();
      this._formDialogService.close();
      this.$service().reload();
      this._messageService.add({ severity: 'success', summary, life: 3000 });
    } catch {
      // El modal queda abierto con los datos para reintentar.
    } finally {
      this.$saving.set(false);
    }
  }
}
