import type { z } from 'zod';
import type { UserFormSchema, UserSchema } from './user.schema';

export type TUser = z.output<typeof UserSchema>;
export type TUserForm = z.output<typeof UserFormSchema>;
