import * as z from 'zod';
import { EAbility } from '../../core/casl/ability.enum';
import { SUBJECTS } from '../../core/casl/casl.types';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';

/** Una ruta INTERNA: una sola barra inicial, sin esquema, host ni `\`. Espejo del backend. */
export const INTERNAL_ROUTE = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/;

/** Un select sin elegir llega como `''` (o `null` si el dato no lo trae): el contrato lo guarda como `null`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.union([schema, z.literal('')]).nullable().transform((value) => value || null);

/**
 * CONTRATO de `menu_items`. Espejo de ticketlistbe/src/modules/menu-items/schemas/menu-item.schema.ts.
 * QUIÉN ve un ítem lo decide CASL con `subject` + `requiredAction`; sin `subject`, cualquier sesión.
 */
export const MenuItemUpsertSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La clave', min: 2 }) })
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La clave', max: 40 }) })
    .regex(/^[a-z][a-z0-9-]*$/, { error: msg(V.ADMIN.INVALID_KEY) }),
  label: z
    .string()
    .trim()
    .min(2, { error: msg(V.GENERIC.MIN_LENGTH, { field: 'La etiqueta', min: 2 }) })
    .max(60, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La etiqueta', max: 60 }) }),
  route: z
    .string()
    .trim()
    .max(200, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'La ruta', max: 200 }) })
    .regex(INTERNAL_ROUTE, { error: msg(V.ADMIN.INVALID_ROUTE) }),
  group: optional(
    z.string().trim().max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El grupo', max: 40 }) }),
  ),
  icon: optional(z.string().trim().regex(/^pi-[a-z0-9-]{1,40}$/, { error: msg(V.ADMIN.INVALID_ICON) })),
  subject: optional(z.enum(SUBJECTS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un recurso' }) })),
  requiredAction: optional(
    z.enum(EAbility, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una acción' }) }),
  ),
  order: z
    .number({ error: msg(V.GENERIC.IS_NUMBER) })
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(0, { error: msg(V.GENERIC.MIN_VALUE, { min: 0 }) })
    .max(999, { error: msg(V.GENERIC.MAX_VALUE, { max: 999 }) }),
  active: z.boolean(),
});

export const MenuItemSchema = z.object({
  uuid: z.uuid(),
  key: z.string(),
  label: z.string(),
  route: z.string(),
  group: z.string().nullable(),
  icon: z.string().nullable(),
  subject: z.enum(SUBJECTS).nullable(),
  requiredAction: z.enum(EAbility).nullable(),
  order: z.number().int(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
});
