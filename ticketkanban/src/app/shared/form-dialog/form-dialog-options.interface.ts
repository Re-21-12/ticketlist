import type { z } from 'zod';
import type { IFormDefinition } from '../dynamic-form/form-definition.interface';

/** Lo único que cambia por pantalla al abrir el modal de alta/edición. */
export interface IFormDialogOptions<TSchema extends z.ZodObject = z.ZodObject> {
  header: string;
  definition: IFormDefinition<TSchema>;
  /** `null`/ausente = alta; un registro = edición precargada. */
  initialData?: Partial<z.input<TSchema>> | null;
  readonlyMode?: boolean;
  submitLabel?: string;
  /** Recibe el payload ya parseado por Zod. El caller hace el request y cierra con `close()` si salió bien. */
  onSubmit: (value: z.output<TSchema>) => void;
  /** Estado de envío del caller: deshabilita Guardar y la X mientras hay un request en vuelo. */
  submitting: () => boolean;
  /** Override del ancho; por defecto se adapta a la cantidad de campos. */
  width?: { width: string; maxWidth: string };
}

/** Lo que viaja en `DynamicDialogConfig.data` hasta `DynamicFormDialog`. */
export type TDynamicFormDialogData = Required<
  Pick<IFormDialogOptions, 'definition' | 'onSubmit' | 'submitting'>
> &
  Pick<IFormDialogOptions, 'initialData' | 'readonlyMode' | 'submitLabel'>;
