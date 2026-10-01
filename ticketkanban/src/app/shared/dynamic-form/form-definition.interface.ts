import type { z } from 'zod';
import type { IFieldConfig } from './field-config.interface';
import { assertValidSections } from './utils/form-sections.util';

/** Agrupa campos bajo un encabezado (secciones visibles o pasos de un stepper). */
export interface IFormSection<TKey extends string = string> {
  key: string;
  label: string;
  fieldKeys: TKey[];
}

export type TFormLayout = 'sections' | 'stepper';

/** Keys del modelo de entrada del schema — así un `IFieldConfig` no puede apuntar a un campo inexistente. */
export type TSchemaKey<TSchema extends z.ZodObject> = Extract<keyof z.input<TSchema>, string>;

/**
 * Una sola fuente de verdad por formulario (equivale a `FormFields` + `*-form.config.ts` de
 * wallet-api):
 *  - `schema`   → reglas de validación y forma del payload (compartido con el BFF).
 *  - `fields`   → cómo se pinta cada campo.
 *  - `sections` → agrupación opcional; sin ella, >6 campos se auto-agrupan.
 */
export interface IFormDefinition<TSchema extends z.ZodObject = z.ZodObject> {
  /** Nombre para los mensajes de error de configuración (`defineForm`). */
  name?: string;
  schema: TSchema;
  fields: IFieldConfig<TSchemaKey<TSchema>>[];
  sections?: IFormSection<TSchemaKey<TSchema>>[];
  layout?: TFormLayout;
}

/**
 * Helper de inferencia: `defineForm({ schema, fields })` tipa las keys contra el schema y además
 * REVISA las secciones (campo en dos secciones, en ninguna, o inexistente) al cargar el módulo:
 * un error de configuración falla de inmediato y con nombre, no como un campo duplicado en pantalla.
 */
export function defineForm<TSchema extends z.ZodObject>(
  definition: IFormDefinition<TSchema>,
): IFormDefinition<TSchema> {
  assertValidSections(definition.name ?? 'sin nombre', definition.fields, definition.sections);
  return definition;
}
