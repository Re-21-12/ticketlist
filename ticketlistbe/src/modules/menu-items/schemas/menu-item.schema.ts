import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { EAbility } from '../../auth/casl/ability.enum.js';
import { SUBJECTS } from '../../auth/casl/casl.types.js';

/** Una ruta INTERNA (`/tickets`, `/profile?tab=sessions`): una sola barra inicial, sin esquema, host ni `\`. */
export const INTERNAL_ROUTE = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/;

/**
 * Ítem del menú (en wallet-api: tabla `menu_items`). QUIÉN lo ve lo decide CASL en el front con
 * `subject` + `requiredAction`; sin `subject` lo ve cualquier persona con sesión.
 */
export const MenuItemBaseSchema = z.object({
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
  group: z
    .string()
    .trim()
    .max(40, { error: msg(V.GENERIC.MAX_LENGTH, { field: 'El grupo', max: 40 }) })
    .nullable()
    .default(null),
  icon: z
    .string()
    .trim()
    .regex(/^pi-[a-z0-9-]{1,40}$/, { error: msg(V.ADMIN.INVALID_ICON) })
    .nullable()
    .default(null),
  subject: z
    .enum(SUBJECTS, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un recurso' }) })
    .nullable()
    .default(null),
  requiredAction: z
    .enum(EAbility, { error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'una acción' }) })
    .nullable()
    .default(null),
  order: z.coerce
    .number()
    .int({ error: msg(V.GENERIC.IS_INTEGER) })
    .min(0, { error: msg(V.GENERIC.MIN_VALUE, { field: 'El orden', min: 0 }) })
    .max(999, { error: msg(V.GENERIC.MAX_VALUE, { field: 'El orden', max: 999 }) })
    .default(100),
  active: z.boolean().default(true),
});

export const MenuItemCreateSchema = MenuItemBaseSchema;
export const MenuItemUpdateSchema = MenuItemBaseSchema;

export const MenuItemResponseSchema = MenuItemBaseSchema.extend({
  uuid: z.uuid(),
  createdAt: z.iso.datetime(),
});

export const MenuItemFilterSchema = z.object({
  group: z.string().trim().max(40).optional(),
});
