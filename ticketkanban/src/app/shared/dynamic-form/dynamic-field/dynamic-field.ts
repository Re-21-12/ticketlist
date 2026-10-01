import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, type FieldTree } from '@angular/forms/signals';
import { AutoCompleteModule } from '@openng/optimus-ui/autocomplete';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { ColorPickerModule } from '@openng/optimus-ui/colorpicker';
import { DatePickerModule } from '@openng/optimus-ui/datepicker';
import { FileUpload, FileUploadModule } from '@openng/optimus-ui/fileupload';
import { InputGroupModule } from '@openng/optimus-ui/inputgroup';
import { InputGroupAddonModule } from '@openng/optimus-ui/inputgroupaddon';
import { InputMaskModule } from '@openng/optimus-ui/inputmask';
import { InputNumberModule } from '@openng/optimus-ui/inputnumber';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { MultiSelectModule } from '@openng/optimus-ui/multiselect';
import { PasswordModule } from '@openng/optimus-ui/password';
import { RadioButtonModule } from '@openng/optimus-ui/radiobutton';
import { SelectModule } from '@openng/optimus-ui/select';
import { SliderModule } from '@openng/optimus-ui/slider';
import { ToggleButtonModule } from '@openng/optimus-ui/togglebutton';
import { ToggleSwitchModule } from '@openng/optimus-ui/toggleswitch';
import type { FileSelectEvent } from '@openng/optimus-ui/types/fileupload';
import { FieldType, type IFieldConfig, type IFieldOption } from '../field-config.interface';
import { FieldFooter } from '../parts/field-footer/field-footer';
import { FieldLabel } from '../parts/field-label/field-label';
import { NO_CONSTRAINTS, TEXTUAL_TYPES, type IFieldConstraints } from '../utils/field-constraints.util';
import { resolveFieldIcon } from '../utils/infer-field-icon.util';
import { filterKeypress, filterPaste, resolveInputFilter } from '../utils/input-filters.util';

/** Un SELECT con MÁS opciones que esto se pinta como autocomplete (se escribe para filtrar). */
export const SELECT_AUTOCOMPLETE_THRESHOLD = 10;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type TUploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'error'; message: string };

/**
 * Pinta UN campo ligado a su nodo del FieldTree vía `[formField]` (los componentes de optimus-ui
 * exponen ControlValueAccessor). Port de `DynamicFieldSignal` de wallet-api. Cambia una sola cosa
 * de fondo: la validación es Zod, así que los mensajes de error ya llegan redactados (`issue.message`)
 * y no hay un `switch (error.kind)`; y las restricciones (obligatorio, máximo de caracteres, límites
 * numéricos) llegan DERIVADAS del schema en `$constraints`.
 *
 * Estructura de cada campo: `app-field-label` (nombre + «*» con tooltip / «(Opcional)») → control
 * (con ícono de contexto si corresponde) → `app-field-footer` (razones, error o hint + contador).
 */
@Component({
  selector: 'app-dynamic-field',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    FormField,
    AutoCompleteModule,
    CheckboxModule,
    ColorPickerModule,
    DatePickerModule,
    FileUploadModule,
    InputGroupModule,
    InputGroupAddonModule,
    InputMaskModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    PasswordModule,
    RadioButtonModule,
    SelectModule,
    SliderModule,
    ToggleButtonModule,
    ToggleSwitchModule,
    FieldLabel,
    FieldFooter,
  ],
  templateUrl: './dynamic-field.html',
  styleUrl: './dynamic-field.css',
  host: {
    class: 'df-field',
    '[class.field-error-visible]': '$showError()',
    '[class.field-disabled]': '$isDisabled()',
  },
})
export class DynamicField {
  readonly $field = input.required<IFieldConfig>();
  readonly $node = input.required<FieldTree<unknown>>();
  /** Restricciones derivadas del schema Zod (obligatorio, máximos…). */
  readonly $constraints = input<IFieldConstraints>(NO_CONSTRAINTS);

  protected readonly FieldType = FieldType;
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * `[formField]` valida en compilación que el tipo del nodo coincida con el del control; el nodo
   * llega como `FieldTree<unknown>` (el modelo es dinámico) y cada control declara inputs propios
   * (`pattern: string`, `minLength`…) que chocan con el FieldState. Esos estados solo se llenan con
   * reglas nativas y aquí toda la validación es Zod, así que en runtime nunca se escriben: el
   * `switch` sobre `type` garantiza que el control recibe el valor que su tipo espera. wallet-api
   * resuelve lo mismo tipando el input `node` como `any`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly $anyNode = computed((): any => this.$node());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected readonly $state = computed((): any => this.$node()());

  protected readonly $required = computed(() => this.$constraints().required);
  protected readonly $fieldId = computed(() => `field-${this.$field().key}`);
  protected readonly $labelId = computed(() => `${this.$fieldId()}-label`);
  protected readonly $errorId = computed(() => `${this.$fieldId()}-error`);
  protected readonly $hintId = computed(() => `${this.$fieldId()}-hint`);

  protected readonly $icon = computed(() => resolveFieldIcon(this.$field()));
  protected readonly $hasIcon = computed(() => this.$icon().trim().length > 0);
  protected readonly $placeholder = computed(() => this.$field().placeholder ?? '');
  protected readonly $dateFormat = computed(() => this.$field().dateFormat ?? 'dd/mm/yy');

  protected readonly $showError = computed(() => {
    const state = this.$state();
    return (state.touched() || state.dirty()) && state.invalid();
  });
  /** Primer error activo — el mensaje ya viene de Zod (issue.message) en español. */
  protected readonly $errorMessage = computed(() => this.$state().errors()[0]?.message ?? '');

  /** Razones de deshabilitado (`disabled(path, 'texto')` en el schema): se muestran para que el usuario sepa POR QUÉ. */
  protected readonly $disabledReasons = computed<string[]>(() =>
    (this.$state().disabledReasons() as readonly { message?: string }[])
      .map((reason) => reason.message)
      .filter((message): message is string => !!message),
  );
  /** Gatea el `cursor: not-allowed` (los controles deshabilitados de PrimeNG tienen `pointer-events: none`). */
  protected readonly $isDisabled = computed(() => !!this.$state().disabled());

  /** CHECKBOX/TOGGLE muestran el hint DENTRO de su tarjeta: el pie lo omite para no repetirlo. */
  protected readonly $isCardType = computed(() => {
    const type = this.$field().type;
    return type === FieldType.CHECKBOX || type === FieldType.TOGGLE;
  });
  protected readonly $footerHint = computed(() => (this.$isCardType() ? '' : (this.$field().hint ?? '')));
  /** El control se describe con el error si lo hay, o con el hint (WCAG 3.3.2). */
  protected readonly $describedBy = computed(() => {
    if (this.$showError()) return this.$errorId();
    return this.$footerHint() ? this.$hintId() : null;
  });

  // ── Contador «n / máx» y límite de escritura ───────────────────────────────────────────────────
  private readonly $_isTextual = computed(() => TEXTUAL_TYPES.has(this.$field().type));
  /** Máximo de caracteres: sale del schema Zod (misma regla que valida el BFF). */
  protected readonly $maxLength = computed(() =>
    this.$_isTextual() ? this.$constraints().maxLength : null,
  );
  protected readonly $currentLength = computed(() => {
    if (!this.$_isTextual()) return null;
    const value = this.$state().value();
    return typeof value === 'string' ? value.length : 0;
  });

  // ── Filtros de teclado/pegado ──────────────────────────────────────────────────────────────────
  private readonly $_inputFilter = computed(() => resolveInputFilter(this.$field()));
  protected onKeypress(event: KeyboardEvent): void {
    const filter = this.$_inputFilter();
    if (filter) filterKeypress(filter, event);
  }
  protected onPaste(event: ClipboardEvent): void {
    const filter = this.$_inputFilter();
    if (filter) filterPaste(filter, event);
  }

  // ── TOGGLE ─────────────────────────────────────────────────────────────────────────────────────
  protected readonly $toggleLabel = computed(() => {
    const labels = this.$field().toggleLabels ?? { on: 'Sí', off: 'No' };
    return this.$state().value() ? labels.on : labels.off;
  });

  // ── Opciones: SELECT / MULTISELECT / RADIO / AUTOCOMPLETE ──────────────────────────────────────
  protected readonly $options = computed<IFieldOption[]>(() => this.$field().options ?? []);
  protected readonly $useAutocompleteForSelect = computed(
    () => this.$options().length > SELECT_AUTOCOMPLETE_THRESHOLD,
  );
  /** Opción cuyo `value` es el valor actual — el autocomplete de SELECT muestra su `label`. */
  protected readonly $selectedOption = computed(() => {
    const current = this.$state().value();
    if (current === null || current === undefined || current === '') return null;
    return this.$options().find((option) => option.value === current) ?? null;
  });
  protected readonly $optionSuggestions = signal<IFieldOption[]>([]);
  protected readonly $textSuggestions = signal<string[]>([]);

  protected filterOptions(event: { query: string }): void {
    const query = (event.query ?? '').toLowerCase();
    this.$optionSuggestions.set(
      this.$options().filter((option) => !query || option.label.toLowerCase().includes(query)),
    );
  }

  /** El autocomplete de SELECT trabaja con el objeto de la opción; el modelo guarda su `value`. */
  protected onSelectAutocomplete(selected: unknown): void {
    if (selected && typeof selected === 'object' && 'value' in selected) {
      this.$state().value.set((selected as IFieldOption).value);
    } else if (selected === null || selected === '') {
      this.$state().value.set(null);
    }
    // Un string mientras se escribe se ignora: `forceSelection` lo descarta al perder el foco.
  }

  protected filterText(event: { query: string }): void {
    const query = (event.query ?? '').toLowerCase();
    this.$textSuggestions.set(
      this.$options()
        .filter((option) => !query || option.label.toLowerCase().includes(query))
        .map((option) => option.label),
    );
  }

  // ── FILE ───────────────────────────────────────────────────────────────────────────────────────
  protected readonly $fileValue = computed(() => {
    const value = this.$state().value();
    return value instanceof File ? value : null;
  });
  protected readonly $fileList = computed(() => (this.$fileValue() ? [this.$fileValue() as File] : []));
  protected readonly $fileUpload = viewChild(FileUpload);
  protected readonly $acceptedFormats = computed(() => {
    const accept = this.$field().accept;
    if (!accept) return 'Cualquier formato';
    return accept
      .split(',')
      .map((part) => part.trim().replace(/^\./, '').toUpperCase())
      .filter(Boolean)
      .join(', ');
  });

  /**
   * Si el valor se vació por fuera (botón Limpiar, otro `initialData`), se vacía también el picker:
   * `[files]` no puede hacerlo porque FileUpload ignora los arrays vacíos.
   */
  private readonly _syncFilePicker = effect(() => {
    if (!this.$fileValue()) this.$fileUpload()?.clear();
  });

  protected onFileSelect(event: FileSelectEvent): void {
    // `currentFiles` son los que PASARON la validación del picker (accept/tamaño); `files` puede traer uno inválido.
    this.$state().value.set(event.currentFiles[0] ?? null);
  }
  protected onFileRemove(): void {
    this.$state().value.set(null);
  }

  // ── IMAGE_UPLOAD ───────────────────────────────────────────────────────────────────────────────
  private readonly $_upload = signal<TUploadState>({ status: 'idle' });
  protected readonly $uploading = computed(() => this.$_upload().status === 'uploading');
  protected readonly $uploadError = computed(() => {
    const state = this.$_upload();
    return state.status === 'error' ? state.message : null;
  });
  protected readonly $imagePreview = computed(() => {
    const value = this.$state().value();
    return typeof value === 'string' && value ? value : '';
  });

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      this.$_upload.set({ status: 'error', message: 'El archivo supera el límite de 2 MB.' });
      input.value = '';
      return;
    }
    this.$_upload.set({ status: 'uploading' });
    const reader = new FileReader();
    reader.onload = () => {
      this.$state().value.set(reader.result as string | null);
      this.$_upload.set({ status: 'idle' });
      input.value = '';
    };
    reader.onerror = () => {
      this.$_upload.set({ status: 'error', message: 'Error al leer el archivo.' });
      input.value = '';
    };
    reader.readAsDataURL(file);
  }
  protected removeImage(): void {
    this.$state().value.set(null);
    this.$_upload.set({ status: 'idle' });
  }

  // ── COLOR / PHONE ──────────────────────────────────────────────────────────────────────────────
  protected readonly $colorValue = computed(() => {
    const value = this.$state().value();
    return typeof value === 'string' ? value : '';
  });

  /**
   * PHONE usa `ngModel` y no `[formField]`: `p-inputmask` llama `onModelTouched()` al iniciar la
   * máscara, lo que marcaría el campo como tocado desde el primer render. Con `ngModel` + `onBlur`
   * explícito, «tocado» solo ocurre tras una interacción real.
   */
  protected onPhoneChange(value: string | null): void {
    this.$state().value.set(value ?? null);
  }
  protected markTouched(): void {
    this.$state().markAsTouched();
  }

  protected asDate(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    return value instanceof Date ? value : new Date(value);
  }

  /** Enfoca el control real (los hosts de optimus-ui no son focuseables). Lo usa el form tras un submit inválido. */
  focus(): void {
    this._elementRef.nativeElement
      .querySelector<HTMLElement>(
        '[role="combobox"], [role="switch"], [role="checkbox"], [role="radio"], textarea, ' +
          '.p-fileupload-choose, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
      )
      ?.focus();
  }
}
