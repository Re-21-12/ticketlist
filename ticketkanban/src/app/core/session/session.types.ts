import type { z } from 'zod';
import type { ShellSchema } from './session.schema';

export type TShell = z.output<typeof ShellSchema>;
export type TSessionUser = TShell['user'];

/** Body de `POST /api/auth/sign-in` (`SignInDto` de ticketlistbe). */
export interface ISignInRequest {
  email: string;
  password: string;
}
