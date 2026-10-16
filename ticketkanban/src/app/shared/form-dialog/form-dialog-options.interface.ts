import type { z } from 'zod';
import type { IFieldOption } from '../dynamic-form/field-config.interface';
import type { IFormDefinition } from '../dynamic-form/form-definition.interface';
import type { ISummaryCard } from '../ui/summary-card/summary-card';

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
  /** Opciones por campo que llegan en runtime (getter/signal: se vuelve a leer si cambia, p. ej. al terminar de cargar). */
  optionsByField?: () => Record<string, IFieldOption[]>;
  /** Tarjeta de resumen sobre el formulario (p. ej. el ticket que se acaba de cerrar). */
  summary?: ISummaryCard;
  /** Override del ancho; por defecto se adapta a la cantidad de campos. */
  width?: { width: string; maxWidth: string };
}

/** Lo que viaja en `DynamicDialogConfig.data` hasta `DynamicFormDialog`. */
export type TDynamicFormDialogData = Required<
  Pick<IFormDialogOptions, 'definition' | 'onSubmit' | 'submitting'>
> &
  Pick<IFormDialogOptions, 'initialData' | 'readonlyMode' | 'submitLabel' | 'optionsByField' | 'summary'>;
