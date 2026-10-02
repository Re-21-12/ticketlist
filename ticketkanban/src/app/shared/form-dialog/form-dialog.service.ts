import { inject, Service } from '@angular/core';
import { DialogService, type DynamicDialogRef } from '@openng/optimus-ui/dynamicdialog';
import type { z } from 'zod';
import type { TDynamicFormDialogData, IFormDialogOptions } from './form-dialog-options.interface';

/** 36rem alcanza para ≤6 campos en 2 columnas; con secciones/stepper el modal se ensancha. */
function dialogWidth(fieldCount: number): { width: string; maxWidth: string } {
  return { width: '95vw', maxWidth: fieldCount > 6 ? '56rem' : '36rem' };
}

/**
 * Abre el modal de formulario dinámico de forma uniforme (port de `FormDialogService` de
 * wallet-api). Centraliza lo que cada pantalla repetía: guard de doble apertura, `import()` lazy
 * del contenido (fuera del bundle inicial), config fija del modal y `closable` ligado en vivo a
 * `submitting()`.
 *
 * `autoProvided: false`: cada pantalla lo declara en `providers: [DialogService, FormDialogService]`
 * para que `dynamicdialog` no entre al bundle eager y cada pantalla tenga su propio ref.
 */
@Service({ autoProvided: false })
export class FormDialogService {
  private readonly _dialogService = inject(DialogService);
  private _ref: DynamicDialogRef | null = null;
  private _opening = false;

  get isOpen(): boolean {
    return this._ref !== null || this._opening;
  }

  async open<TSchema extends z.ZodObject>(options: IFormDialogOptions<TSchema>): Promise<void> {
    if (this.isOpen) return;
    this._opening = true;
    try {
      const { DynamicFormDialog } = await import('./dynamic-form-dialog');
      const { submitting } = options;
      const data: TDynamicFormDialogData = {
        definition: options.definition,
        initialData: options.initialData ?? null,
        readonlyMode: options.readonlyMode ?? false,
        submitLabel: options.submitLabel,
        onSubmit: options.onSubmit as TDynamicFormDialogData['onSubmit'],
        submitting,
        optionsByField: options.optionsByField,
      };

      this._ref = this._dialogService.open(DynamicFormDialog, {
        header: options.header,
        modal: true,
        // Getter vivo: la X se deshabilita mientras hay un request en vuelo.
        get closable(): boolean {
          return !submitting();
        },
        dismissableMask: false,
        closeOnEscape: false,
        style: options.width ?? dialogWidth(options.definition.fields.length),
        contentStyle: { 'max-height': '75vh', 'overflow-y': 'auto' },
        data,
      });
      this._ref?.onClose.subscribe(() => (this._ref = null));
    } finally {
      this._opening = false;
    }
  }

  /** Cierra el modal (lo llama el caller tras un guardado exitoso). */
  close(): void {
    this._ref?.close();
    this._ref = null;
  }
}
