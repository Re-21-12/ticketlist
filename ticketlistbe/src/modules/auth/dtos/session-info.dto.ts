import * as z from 'zod';

/**
 * Una sesión activa del usuario. `id` NO es el `sid` de la cookie: es un hash opaco. Exponer el `sid`
 * real en la API anularía el `HttpOnly` de la cookie (un XSS podría leerlo y secuestrar la sesión).
 */
export const SessionInfoSchema = z.object({
  id: z.string(),
  /** La sesión desde la que se hace esta consulta. */
  current: z.boolean(),
  ipAddress: z.string(),
  userAgent: z.string(),
  createdAt: z.iso.datetime(),
  /** Cuándo vence por inactividad si no hay más actividad; `null` si el store no lo informa. */
  expiresAt: z.iso.datetime().nullable(),
});

export const SessionListSchema = z.object({ data: z.array(SessionInfoSchema) });

export type TSessionInfo = z.output<typeof SessionInfoSchema>;
