import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';

/**
 * CONTRATO de catálogos (tablas dinámicas). Espejo de ticketlistbe/src/modules/catalogs/schemas/catalog.schema.ts.
 */
const KeySchema = z
  .string()
  .trim()
  .min(2, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La clave', min: 2 }) })
  .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La clave', max: 40 }) })
  .regex(/^[a-z][a-z0-9-]*$/, { error: msg(V.ADMIN.INVALID_KEY) });

const NameSchema = z
  .string()
  .trim()
  .min(2, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El nombre', min: 2 }) })
  .max(60, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El nombre', max: 60 }) });

const DescriptionSchema = z
  .string()
  .trim()
  .max(200, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La descripción', max: 200 }) });

export const CatalogCreateSchema = z.object({ key: KeySchema, name: NameSchema, description: DescriptionSchema });
/** La clave no cambia (la usan formularios y reportes): solo nombre y descripción. */
export const CatalogUpdateSchema = z.object({ name: NameSchema, description: DescriptionSchema });

const ItemBase = {
  label: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La etiqueta', min: 1 }) })
    .max(80, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La etiqueta', max: 80 }) }),
  order: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(0, { error: msg(V.GENERIC.MIN_VALUE, { min: 0 }) })
    .max(999, { error: msg(V.GENERIC.MAX_VALUE, { max: 999 }) }),
  active: z.boolean(),
};

/** Color de la insignia de un elemento: las severidades del tema (siguen claro/oscuro y el color de marca). */
export const CATALOG_SEVERITIES = ['secondary', 'info', 'success', 'warn', 'danger', 'contrast'] as const;
export const CATALOG_SEVERITY_LABELS: Record<(typeof CATALOG_SEVERITIES)[number], string> = {
  secondary: 'Neutro',
  info: 'Azul',
  success: 'Verde',
  warn: 'Ámbar',
  danger: 'Rojo',
  contrast: 'Oscuro',
};

/** Un campo opcional llega como `''`, `null` o ausente y el contrato lo guarda como `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.literal('')]).nullish().transform((value) => value || null);

const IconSchema = optional(z.string().trim().regex(/^pi-[a-z0-9-]{1,40}$/, { error: msg(V.ADMIN.INVALID_ICON) }));
const SeveritySchema = optional(
  z.enum(CATALOG_SEVERITIES, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un color' }) }),
);

export const CatalogItemUpsertSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El código', min: 1 }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El código', max: 40 }) })
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, { error: msg(V.ADMIN.INVALID_CODE) }),
  ...ItemBase,
  /** Opcional: `''` = sin ícono / color (el formulario lo manda así y el servicio lo traduce a `null`). */
  icon: IconSchema,
  severity: SeveritySchema,
});

export const CatalogItemSchema = z.object({
  uuid: z.uuid(),
  code: z.string(),
  label: z.string(),
  order: z.number().int(),
  active: z.boolean(),
  icon: z.string().nullable(),
  severity: z.enum(CATALOG_SEVERITIES).nullable(),
  system: z.boolean(),
});

export const CatalogSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  system: z.boolean(),
  itemCount: z.number().int(),
});
export const CatalogListSchema = z.object({ data: z.array(CatalogSummarySchema) });
export const CatalogDetailSchema = CatalogSummarySchema.extend({ items: z.array(CatalogItemSchema) });
