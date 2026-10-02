import * as z from 'zod';
import { EAbility, EUserRole } from '../casl/ability.enum';
import { SUBJECTS } from '../casl/casl.types';

const SubjectSchema = z.enum(SUBJECTS);

/** Regla CASL tal como la serializa el backend (`ability.rules` / `packRules` sin empaquetar). */
export const AbilityRuleSchema = z.object({
  action: z.enum(EAbility),
  subject: SubjectSchema,
  conditions: z.record(z.string(), z.unknown()).optional(),
  inverted: z.boolean().optional(),
});

export const NavItemSchema = z.object({
  key: z.string(),
  label: z.string(),
  route: z.string(),
  group: z.string().optional(),
  /** Clase de ícono (`pi-users`) administrable desde «Menú». */
  icon: z.string().optional(),
  subject: SubjectSchema.optional(),
  requiredAction: z.enum(EAbility).optional(),
  hiddenForRoles: z.array(z.enum(EUserRole)).optional(),
});

/**
 * Respuesta de `GET /api/bff/shell`: todo lo que el shell necesita en UNA llamada (usuario,
 * reglas CASL resueltas por el backend y catálogo del menú). Patrón BFF: la pantalla pide su
 * forma exacta en vez de componerla con varias llamadas.
 */
export const ShellSchema = z.object({
  user: z.object({
    uuid: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(EUserRole),
    /** Clase de ícono del avatar (`pi-star`) o `null` = iniciales. */
    avatarIcon: z.string().nullable(),
    avatarColor: z.string().nullable(),
  }),
  abilityRules: z.array(AbilityRuleSchema),
  menu: z.array(NavItemSchema),
});
