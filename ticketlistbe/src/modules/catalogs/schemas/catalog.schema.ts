import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';

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
  .max(200, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La descripción', max: 200 }) })
  .default('');

/** Catálogo = tabla de valores administrable (en wallet-api: «tablas dinámicas» / catalogs). */
export const CatalogCreateSchema = z.strictObject({ key: KeySchema, name: NameSchema, description: DescriptionSchema });
/** La clave no cambia (la usan los formularios y reportes): solo nombre y descripción. */
export const CatalogUpdateSchema = z.strictObject({ name: NameSchema, description: DescriptionSchema });

export const CatalogItemBaseSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'El código', min: 1 }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El código', max: 40 }) })
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, { error: msg(V.ADMIN.INVALID_CODE) }),
  label: z
    .string()
    .trim()
    .min(1, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La etiqueta', min: 1 }) })
    .max(80, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La etiqueta', max: 80 }) }),
  order: z.coerce
    .number()
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(0, { error: msg(V.GENERIC.MIN_VALUE, { min: 0 }) })
    .max(999, { error: msg(V.GENERIC.MAX_VALUE, { max: 999 }) })
    .default(100),
  active: z.boolean().default(true),
  /** Clase PrimeIcons de la insignia (`pi-clock`); vacío = sin ícono. */
  icon: z
    .string()
    .trim()
    .regex(/^pi-[a-z0-9-]{1,40}$/, { error: msg(V.ADMIN.INVALID_ICON) })
    .nullable()
    .default(null),
  /** Color de la insignia (severidad del tema). */
  severity: z.enum(['secondary', 'info', 'success', 'warn', 'danger', 'contrast'], { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un color' }) }).nullable().default(null),
});
export const CatalogItemCreateSchema = CatalogItemBaseSchema;
export const CatalogItemUpdateSchema = CatalogItemBaseSchema;

export const CatalogItemResponseSchema = z.object({
  uuid: z.uuid(),
  code: z.string(),
  label: z.string(),
  order: z.number().int(),
  active: z.boolean(),
  /** De sistema: el código y el estado «activo» no se tocan, ni se elimina (lo usa el código). */
  system: z.boolean(),
  icon: z.string().nullable(),
  severity: z.enum(['secondary', 'info', 'success', 'warn', 'danger', 'contrast']).nullable(),
});

export const CatalogSummarySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  system: z.boolean(),
  itemCount: z.number().int(),
});
export const CatalogListSchema = z.object({ data: z.array(CatalogSummarySchema) });

export const CatalogDetailSchema = CatalogSummarySchema.extend({ items: z.array(CatalogItemResponseSchema) });

/** Lo que consumen los formularios: solo ítems ACTIVOS, ya ordenados. */
export const CatalogOptionsSchema = z.object({
  data: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      icon: z.string().nullable(),
      severity: z.enum(['secondary', 'info', 'success', 'warn', 'danger', 'contrast']).nullable(),
    }),
  ),
});

export const CatalogKeyParamSchema = z.object({ key: KeySchema });
export const CatalogItemParamSchema = z.object({ key: KeySchema, uuid: z.uuid({ error: msg(V.GENERIC.IS_UUID) }) });
