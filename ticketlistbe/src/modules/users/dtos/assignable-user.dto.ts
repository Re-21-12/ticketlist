import * as z from 'zod';
import { EUserRole } from '../../auth/casl/ability.enum.js';

/** Persona a la que se le puede asignar un ticket: lo mínimo para mostrarla y asignar por correo. */
export const AssignableUserSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: z.enum(EUserRole),
});

export const AssignableUserListSchema = z.object({ data: z.array(AssignableUserSchema) });
