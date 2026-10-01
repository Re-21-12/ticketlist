import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { form, FormRoot, type FieldTree } from '@angular/forms/signals';
import { ButtonModule } from '@openng/optimus-ui/button';
import { StepperModule } from '@openng/optimus-ui/stepper';
import type { z } from 'zod';
import { computeAutoSections } from './auto-sections.util';
import { DynamicField } from './dynamic-field/dynamic-field';
import type { IFieldConfig } from './field-config.interface';
import type { IFormDefinition, IFormSection } from './form-definition.interface';
import { buildModel } from './model-builder';
import { buildSchemaFn } from './schema-builder';
import { omitKeys } from './zod-field.util';
import { deriveAllConstraints } from './utils/field-constraints.util';

type TModel = Record<string, unknown>;

/**
 * Formulario dinámico sobre Signal Forms + Zod. Port de `DynamicFormSignal` (wallet-api) con el
 * mismo API público (definición/initialData/readonlyMode/submitting → output), con dos cambios:
 *
 *  1. Valida con el schema Zod de la definición (`validateStandardSchema`), no con metadata suelta.
 *  2. Emite el payload YA PARSEADO por Zod (`z.output<TSchema>`: trims, coerciones, defaults),
 *     tipado — no un `JSON.stringify` que cada pantalla vuelve a `JSON.parse`.
 *
 * Layout: ≤6 campos → grid plano; más, o con `sections` → 'stepper' (default) o 'sections'.
 */
@Component({
  selector: 'app-dynamic-form',
  imports: [FormRoot, DynamicField, ButtonModule, StepperModule, NgTemplateOutlet],
  templateUrl: './dynamic-form.html',
  styleUrl: './dynamic-form.css',
})
export class DynamicForm<TSchema extends z.ZodObject = z.ZodObject> {
  readonly $definition = input.required<IFormDefinition<TSchema>>();
  /** `null` = alta; un registro = edición precargada. */
  readonly $initialData = input<Partial<z.input<TSchema>> | null>(null);
  readonly $readonlyMode = input(false);
  /** true mientras el padre hace el request — deshabilita Guardar/Limpiar. */
  readonly $submitting = input(false);
  readonly $submitLabel = input('Guardar');
  readonly $showClear = input(true);
  readonly $singleColumn = input(false);

  readonly $submitted = output<z.output<TSchema>>();

  private readonly _injector = inject(Injector);
  private readonly $_model = signal<TModel>({});
  protected readonly $tree = signal<FieldTree<TModel> | null>(null);
  private readonly $_fieldRefs = viewChildren(DynamicField);

  constructor() {
    // `form()` registra effects internos: no puede crearse dentro de un contexto reactivo
    // (NG0602), de ahí el `untracked`, y necesita el injector capturado fuera del effect (NG0203).
    // Solo se re-crea si cambian definición/initialData/readonlyMode, no al teclear.
    effect(() => {
      const definition = this.$definition() as IFormDefinition;
      const initial = this.$initialData() as TModel | null;
      const readonlyMode = this.$readonlyMode();
      untracked(() => {
        this.$_model.set(
          buildModel(
            definition.fields,
            initial,
            deriveAllConstraints(definition.schema, definition.fields),
          ),
        );
        this.$tree.set(
          form(this.$_model, buildSchemaFn(definition, { readonlyMode }), {
            injector: this._injector,
            submission: {
              action: async () => this.emitParsed(),
              onInvalid: () => this.focusFirstInvalid(),
            },
          }),
        );
      });
    });
  }

  protected readonly $fields = computed(() => this.$definition().fields as IFieldConfig[]);

  /**
   * Restricciones de cada campo DERIVADAS del schema Zod (obligatorio → asterisco, máximo de
   * caracteres → contador «n / máx» y `maxlength`, límites numéricos). Una sola fuente de verdad:
   * el mismo schema que parsea el BFF.
   */
  protected readonly $constraints = computed(() =>
    deriveAllConstraints(this.$definition().schema, this.$fields()),
  );

  protected readonly $sections = computed<IFormSection[] | null>(() => {
    const explicit = this.$definition().sections;
    return explicit?.length ? explicit : computeAutoSections(this.$fields());
  });
  protected readonly $layout = computed(() => this.$definition().layout ?? 'stepper');
  protected readonly $activeStep = signal(1);
  /** Nombre del paso activo: en móvil el título de cada círculo se oculta y este lo reemplaza. */
  protected readonly $activeSectionLabel = computed(
    () => this.$sections()?.[this.$activeStep() - 1]?.label ?? '',
  );

  private readonly $_root = computed(() => this.$tree()?.());
  protected readonly $dirty = computed(() => this.$_root()?.dirty() ?? false);
  protected readonly $busy = computed(() => this.$submitting() || !!this.$_root()?.submitting());

  /**
   * `dynamic-form-grid` marca la grilla para el CSS que arregla el campo «huérfano» (ver
   * dynamic-form.css) y `--2col` activa la alineación de etiquetas de `app-field-label`. Con
   * `revealField` la cantidad de campos VISIBLES cambia en runtime, así que la paridad par/impar no
   * se puede fijar a mano por formulario.
   */
  protected readonly $gridClass = computed(() =>
    this.$singleColumn() || this.$fields().length <= 2
      ? 'dynamic-form-grid grid grid-cols-1 gap-x-6 gap-y-2 items-start'
      : 'dynamic-form-grid dynamic-form-grid--2col grid grid-cols-1 gap-x-6 gap-y-2 items-start md:grid-cols-2',
  );

  protected nodeFor(key: string): FieldTree<unknown> {
    return (this.$tree() as unknown as Record<string, FieldTree<unknown>>)[key];
  }

  protected isHidden(key: string): boolean {
    return this.nodeFor(key)?.().hidden() ?? true;
  }

  protected fieldsFor(section: IFormSection): IFieldConfig[] {
    const byKey = new Map(this.$fields().map((f) => [f.key, f]));
    return section.fieldKeys.map((key) => byKey.get(key)).filter((f): f is IFieldConfig => !!f);
  }

  /** Un paso es válido si todos sus campos VISIBLES lo son (un revealField oculto no bloquea). */
  protected sectionValid(section: IFormSection): boolean {
    return section.fieldKeys.every((key) => this.isHidden(key) || this.nodeFor(key)().valid());
  }

  protected onClear(): void {
    this.$_root()?.reset();
    this.$_model.set(
      buildModel(this.$fields(), this.$initialData() as TModel | null, this.$constraints()),
    );
  }

  /**
   * Corre solo si el form es válido (`submission.action`). Se parsea con el MISMO schema que usa
   * el BFF: lo que sale de aquí ya es el DTO final. Los campos ocultos no viajan.
   */
  private emitParsed(): void {
    const hiddenKeys = new Set(this.$fields().filter((f) => this.isHidden(f.key)).map((f) => f.key));
    const result = this.$definition().schema.safeParse(omitKeys(this.$_model(), hiddenKeys));
    if (result.success) this.$submitted.emit(result.data as z.output<TSchema>);
  }

  /** A11y: tras un submit inválido, lleva al paso del primer error y enfoca su control. */
  private focusFirstInvalid(): void {
    const first = this.$fields().find(
      (f) => !this.isHidden(f.key) && this.nodeFor(f.key)().invalid(),
    );
    if (!first) return;
    const sectionIndex = this.$sections()?.findIndex((s) => s.fieldKeys.includes(first.key)) ?? -1;
    if (sectionIndex >= 0 && this.$layout() === 'stepper') this.$activeStep.set(sectionIndex + 1);
    afterNextRender(() => this.$_fieldRefs().find((ref) => ref.$field().key === first.key)?.focus(), {
      injector: this._injector,
    });
  }
}
