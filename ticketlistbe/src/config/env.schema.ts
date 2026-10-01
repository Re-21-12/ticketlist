import * as z from 'zod';

/**
 * Variables de entorno validadas AL ARRANCAR: si falta o es inválida una, el proceso no levanta
 * (falla temprano con el detalle, en vez de romper en la primera request que la use).
 */
const DEV_SESSION_SECRET = 'dev-only-session-secret-change-me-please';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origen del front para CORS (sin proxy). */
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  /** Firma de la cookie de sesión. En production es OBLIGATORIO uno propio (>= 32 caracteres). */
  SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
  /**
   * Redis (sesiones, rate limiting, tokens de un solo uso, pub/sub de SSE). Sin él se usa un
   * almacén EN MEMORIA (desarrollo y tests, un solo proceso); en production es OBLIGATORIO.
   */
  REDIS_URL: z.string().min(1).optional(),
  /**
   * Prefijo de TODAS las claves en Redis (sesiones, contadores, tokens): varios entornos (o varias apps)
   * pueden compartir un Redis sin pisarse, y los tests e2e usan uno distinto por prueba.
   */
  REDIS_KEY_PREFIX: z.string().min(1).max(60).default('ticketit:'),
  /** Tope global por IP (req/min). Cada ruta puede ajustarlo con `@RateLimit()`. */
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().min(1).default(300),
  /** Detrás de proxy (Caddy/Traefik): `req.ip` es la IP real y la cookie `Secure` funciona. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Scalar UI (/api/reference) + OpenAPI JSON — apagado por defecto en producción. */
  API_DOCS_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type TEnv = z.output<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): TEnv {
  const env = EnvSchema.parse(source);
  if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEV_SESSION_SECRET) {
    throw new Error('SESSION_SECRET es obligatorio en production (no usar el de desarrollo).');
  }
  if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
    throw new Error('REDIS_URL es obligatorio en production (sesiones y rate limiting compartidos).');
  }
  return env;
}
