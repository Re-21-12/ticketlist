import { Component, inject } from '@angular/core';
import { DynamicDialogConfig } from '@openng/optimus-ui/dynamicdialog';
import { DynamicForm } from '../dynamic-form/dynamic-form';
import type { TDynamicFormDialogData } from './form-dialog-options.interface';

/**
 * Contenido del modal de alta/edición, abierto con `DialogService.open()`. No tiene inputs ni
 * outputs propios: lee su config de `DynamicDialogConfig.data` y llama `data.onSubmit()` (un
 * componente abierto dinámicamente no expone sus outputs, solo el `onClose` del ref).
 *
 * NO cierra el diálogo al enviar: si el request falla, el modal debe quedar abierto con los
 * datos para reintentar. Quien cierra es el caller, vía `FormDialogService.close()`.
 */
@Component({
  selector: 'app-dynamic-form-dialog',
  imports: [DynamicForm],
  templateUrl: './dynamic-form-dialog.html',
  styleUrl: './dynamic-form-dialog.css',
})
export class DynamicFormDialog {
  protected readonly _config = inject<DynamicDialogConfig<TDynamicFormDialogData>>(DynamicDialogConfig);
}
