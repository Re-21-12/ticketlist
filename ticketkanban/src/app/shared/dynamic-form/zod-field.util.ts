import type { z } from 'zod';
import type { IFieldConfig } from './field-config.interface';
import { isRequired } from './utils/field-constraints.util';

/**
 * ¿El schema exige un valor para este campo? Se deduce del propio Zod en vez de duplicar un
 * `state.required` en la config (ver `field-constraints.util.ts`).
 */
export function isFieldRequired(schema: z.ZodObject, field: IFieldConfig): boolean {
  const fieldSchema = schema.shape[field.key] as z.ZodType | undefined;
  return fieldSchema ? isRequired(fieldSchema, field) : false;
}

/** Quita del payload los campos ocultos (p. ej. un revealField no activado) antes de parsear. */
export function omitKeys(
  value: Record<string, unknown>,
  keys: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.has(key)));
}
