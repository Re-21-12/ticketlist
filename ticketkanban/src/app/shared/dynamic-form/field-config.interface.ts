/**
 * Tipos de control que sabe pintar `app-dynamic-field`. Mismo catálogo que `HtmlTypes` de
 * wallet-api (excepto `BULK_IMPORT`, la carga masiva por CSV, que ninguna pantalla de Ticketit
 * usa). Las claves coinciden con las de wallet-api para poder portar sus `*-form.config.ts`.
 */
export const FieldType = {
  TEXT: 'text',
  /** Texto que solo admite dígitos (serial, código) pero conserva ceros a la izquierda. */
  TEXT_NUMBER: 'text_number',
  TEXTAREA: 'textarea',
  EMAIL: 'email',
  URL: 'url',
  PASSWORD: 'password',
  PHONE: 'tel',
  NUMBER: 'number',
  INTEGER: 'integer',
  DECIMAL: 'decimal',
  CURRENCY: 'currency',
  SLIDER: 'range',
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime-local',
  DATE_RANGE: 'daterange',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  AUTOCOMPLETE: 'autocomplete',
  CHECKBOX: 'checkbox',
  TOGGLE: 'toggle',
  TOGGLE_BUTTON: 'togglebutton',
  RADIO: 'radio',
  RADIO_BUTTON: 'radiobutton',
  COLOR: 'color',
  FILE: 'file',
  IMAGE_UPLOAD: 'image_upload',
} as const;
export type TFieldType = (typeof FieldType)[keyof typeof FieldType];

export interface IFieldOption {
  value: string | number;
  label: string;
  /** Clase de ícono junto a la opción (solo `RADIO_BUTTON`). */
  icon?: string;
}

/**
 * Filtro de teclado y pegado de un `<input>` (bloquea el carácter ANTES de que entre; el schema Zod
 * sigue validando). Los numéricos se aplican solos según el tipo; `letters` y `email` son opt-in
 * porque son decisiones de cada campo — wallet-api filtraba TODO `TEXT` a letras, lo que no sirve
 * para un título como «Falla en TCK-12».
 */
export type TInputFilter = 'letters' | 'integer' | 'decimal' | 'money' | 'email';

/** Estado de UI del campo. La validación NO vive aquí: sale del schema Zod del formulario. */
export interface IFieldUiState {
  hidden?: boolean;
  disabled?: boolean;
  /** Se muestra bajo el campo para explicar por qué está deshabilitado. */
  disabledReason?: string;
  readonly?: boolean;
}

/** Patrón "Otros: especifique": cuando el campo disparador vale `whenValue`, se revela `key`. */
export interface IRevealRule<TKey extends string = string> {
  key: TKey;
  whenValue: string | number | boolean;
}

/**
 * Cómo se refleja el campo en `app-dynamic-table` — misma idea que `FieldBase.table` de
 * wallet-api: UNA lista de campos alimenta el formulario y las columnas (ver
 * `shared/dynamic-table/utils/build-columns.ts`). `show` es opt-in.
 */
export interface IFieldTableConfig {
  show?: boolean;
  header?: string;
  dataType?: 'string' | 'number' | 'boolean' | 'date';
}

/**
 * Descripción de UN campo. Diferencia clave con `FieldBase` de wallet-api: aquí no hay
 * `required`/`minLength`/`maxLength`/`minValue`/`maxValue`/`pattern`… — todo eso lo declara el
 * schema Zod (el mismo que valida el BFF) y el formulario lo DERIVA (`field-constraints.util.ts`):
 * el asterisco, el contador «n / máx», el `maxlength` del control y los límites de los números.
 * Este objeto solo describe cómo se ve el campo.
 */
export interface IFieldConfig<TKey extends string = string> {
  key: TKey;
  label: string;
  type: TFieldType;
  placeholder?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras el campo muestra un error. */
  hint?: string;
  options?: IFieldOption[];
  state?: IFieldUiState;
  revealField?: IRevealRule<TKey>[];
  /** Ocupa las dos columnas del grid (los textos de 255+ caracteres ya lo hacen solos). */
  fullWidth?: boolean;
  /**
   * Ícono de contexto dentro del campo (clase `pi pi-*`). Si no se declara se infiere del nombre
   * y del tipo (`infer-field-icon.util.ts`); `''` lo desactiva.
   */
  icon?: string;
  /** TEXTAREA: filas visibles (default 4). */
  rows?: number;
  /** TOGGLE: texto del estado encendido/apagado (default «Sí» / «No»). */
  toggleLabels?: { on: string; off: string };
  /** Atributo HTML `autocomplete` (`current-password`, `username`, `off`…). */
  autocomplete?: string;
  inputFilter?: TInputFilter;
  /** PHONE: máscara de `p-inputmask` (default `(999) 999-9999`). */
  mask?: string;
  /** SLIDER: tamaño de cada paso (default 1). */
  step?: number;
  /** DATE/DATE_RANGE: vista del calendario. */
  dateView?: 'date' | 'month' | 'year';
  /** Formato de `p-datepicker` (default `dd/mm/yy`). */
  dateFormat?: string;
  /** Límites del calendario (deshabilitan días); la validación real sigue siendo la del schema. */
  minDate?: Date | string;
  maxDate?: Date | string;
  /** FILE: extensiones/MIME aceptados (`.pdf,.png` o `image/*`). */
  accept?: string;
  /** Columna en `app-dynamic-table`. */
  table?: IFieldTableConfig;
}
