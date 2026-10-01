import { FieldType, type IFieldConfig } from './field-config.interface';
import type { IFieldConstraints } from './utils/field-constraints.util';

/**
 * Valor vacío por tipo.
 *
 * Los controles que son un `<input>` NATIVO de texto (incluido CURRENCY: «Q» + texto con 2
 * decimales) arrancan en `''`, nunca en `null`: Signal
 * Forms decide si un `<input>` es numérico mirando si el modelo es `number` o `null`, así que un
 * texto con `null` dispara `NativeInputParseError` al escribir letras (bug real documentado en
 * wallet-api, `model-builder.ts`). Los componentes de optimus-ui (p-select, p-inputnumber…) van
 * por su propio ControlValueAccessor y no sufren esa ambigüedad.
 */
function emptyValue(field: IFieldConfig, constraints?: IFieldConstraints): unknown {
  switch (field.type) {
    case FieldType.TEXT:
    case FieldType.TEXT_NUMBER:
    case FieldType.TEXTAREA:
    case FieldType.EMAIL:
    case FieldType.URL:
    case FieldType.PASSWORD:
    case FieldType.CURRENCY:
      return '';
    case FieldType.CHECKBOX:
    case FieldType.TOGGLE:
    case FieldType.TOGGLE_BUTTON:
      return false;
    case FieldType.MULTISELECT:
      return [];
    // Un slider siempre muestra un valor: arranca en su mínimo (el del schema), no en `null`.
    case FieldType.SLIDER:
      return constraints?.minimum ?? 0;
    default:
      return null;
  }
}

/**
 * Modelo inicial del form (única fuente de verdad en Signal Forms). `initialData` (edición) pisa
 * los vacíos campo a campo. Nunca deja `undefined`: Signal Forms descarta ese child del árbol y el
 * template revienta al pedir su nodo (bug real de wallet-api, glucose-measurement-form).
 */
export function buildModel(
  fields: readonly IFieldConfig[],
  initialData?: Record<string, unknown> | null,
  constraints?: ReadonlyMap<string, IFieldConstraints>,
): Record<string, unknown> {
  const source = initialData ?? {};
  return Object.fromEntries(
    fields.map((field) => {
      const value = source[field.key];
      return [field.key, value === undefined ? emptyValue(field, constraints?.get(field.key)) : value];
    }),
  );
}
