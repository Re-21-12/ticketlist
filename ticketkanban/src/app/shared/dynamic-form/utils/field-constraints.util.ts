import * as z from 'zod';
import { FieldType, type IFieldConfig } from '../field-config.interface';

/**
 * Restricciones de un campo DERIVADAS del schema Zod — la única fuente de verdad. En wallet-api
 * eran metadata a mano (`FieldBase.maxLength`, `minValue`…) duplicada del DTO del backend; aquí el
 * formulario las lee del mismo schema que valida el BFF, así el contador `n / máx` y el `maxlength`
 * del control nunca pueden diferir de la regla real.
 */
export interface IFieldConstraints {
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minimum: number | null;
  maximum: number | null;
}

export const NO_CONSTRAINTS: IFieldConstraints = {
  required: false,
  minLength: null,
  maxLength: null,
  minimum: null,
  maximum: null,
};

interface IJsonSchemaNode {
  type?: string | string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  anyOf?: IJsonSchemaNode[];
  oneOf?: IJsonSchemaNode[];
}

/** Rama útil de un `anyOf`/`oneOf` (descarta `null`: viene de `.nullable()`/`.optional()`). */
function usefulBranch(node: IJsonSchemaNode): IJsonSchemaNode {
  const branches = node.anyOf ?? node.oneOf;
  if (!branches) return node;
  const nonNull = branches.filter((b) => b.type !== 'null');
  return nonNull.length === 1 ? usefulBranch(nonNull[0]) : (nonNull[0] ?? node);
}

function numeric(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Tipos textuales: muestran contador y limitan la escritura con `maxlength`. */
export const TEXTUAL_TYPES: ReadonlySet<string> = new Set<string>([
  FieldType.TEXT,
  FieldType.TEXT_NUMBER,
  FieldType.TEXTAREA,
  FieldType.EDITOR,
  FieldType.EMAIL,
  FieldType.URL,
  FieldType.PASSWORD,
]);

/** ¿El schema exige un valor? Se deduce probando `undefined`, `null` y `''` contra el propio Zod. */
export function isRequired(schema: z.ZodType, field: IFieldConfig): boolean {
  // Un switch siempre tiene valor (on/off); un checkbox es obligatorio solo si exige `true`.
  if (field.type === FieldType.TOGGLE || field.type === FieldType.TOGGLE_BUTTON) return false;
  if (field.type === FieldType.CHECKBOX) return !schema.safeParse(false).success;
  // Un multiselect vacío (`[]`) es un valor válido salvo que el schema exija `.min(1)`.
  const empties = field.type === FieldType.MULTISELECT ? [undefined, null, '', []] : [undefined, null, ''];
  return empties.every((value) => !schema.safeParse(value).success);
}

/**
 * Lee las restricciones del campo en el schema del formulario. Devuelve `NO_CONSTRAINTS` si la
 * clave no existe en el schema o el schema no se puede representar (p. ej. un `transform`).
 */
export function deriveConstraints(schema: z.ZodObject, field: IFieldConfig): IFieldConstraints {
  const fieldSchema = schema.shape[field.key] as z.ZodType | undefined;
  if (!fieldSchema) return NO_CONSTRAINTS;

  let node: IJsonSchemaNode = {};
  try {
    node = usefulBranch(
      z.toJSONSchema(fieldSchema, { io: 'input', unrepresentable: 'any' }) as IJsonSchemaNode,
    );
  } catch {
    // Sin representación JSON (refine con closures, etc.): solo se conoce `required`.
  }

  return {
    required: isRequired(fieldSchema, field),
    minLength: numeric(node.minLength),
    maxLength: numeric(node.maxLength),
    minimum: numeric(node.minimum ?? node.exclusiveMinimum),
    maximum: numeric(node.maximum ?? node.exclusiveMaximum),
  };
}

/** Restricciones de todos los campos de un formulario, por `key`. */
export function deriveAllConstraints(
  schema: z.ZodObject,
  fields: readonly IFieldConfig[],
): Map<string, IFieldConstraints> {
  return new Map(fields.map((field) => [field.key, deriveConstraints(schema, field)]));
}

/**
 * Mensaje que Zod da a un valor concreto (`undefined` si pasa). Sirve para que una regla NATIVA
 * de Signal Forms (p. ej. `maxLength`, necesaria para que `[formField]` limite la escritura) hable
 * con las MISMAS palabras que el schema, en vez de inventar un texto propio.
 */
export function probeMessage(schema: z.ZodType, value: unknown): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

