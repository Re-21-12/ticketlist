import * as z from 'zod';
import { EAbility, EUserRole } from '../../../modules/auth/casl/ability.enum.js';
import { SUBJECTS } from '../../../modules/auth/casl/casl.types.js';

const SubjectSchema = z.enum(SUBJECTS);

/** Espejo de `ShellSchema` (ticketkanban/src/app/core/session/session.schema.ts). */
export const ShellResponseSchema = z.object({
  user: z.object({
    uuid: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(EUserRole),
    avatarIcon: z.string().nullable(),
    avatarColor: z.string().nullable(),
  }),
  abilityRules: z.array(
    z.object({
      action: z.enum(EAbility),
      subject: SubjectSchema,
      conditions: z.record(z.string(), z.unknown()).optional(),
      inverted: z.boolean().optional(),
    }),
  ),
  menu: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      route: z.string(),
      group: z.string().optional(),
      icon: z.string().optional(),
      subject: SubjectSchema.optional(),
      requiredAction: z.enum(EAbility).optional(),
      hiddenForRoles: z.array(z.enum(EUserRole)).optional(),
    }),
  ),
});

export type TShellResponse = z.output<typeof ShellResponseSchema>;
