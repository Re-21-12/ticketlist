import * as z from 'zod';
import { EUserRole } from '../modules/auth/casl/ability.enum.js';

/**
 * Cuentas iniciales de producción (una por rol, por ejemplo): arreglo JSON `[{ name, email, role, password }]`.
 * Llega como secreto (`SEED_USERS_JSON_FILE` → `SEED_USERS_JSON`, ver `docker/entrypoint.sh`); lo genera
 * `deploy/generate-secrets.mjs` con contraseñas aleatorias. Nunca se guarda en el repo.
 */
export const SeedUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  role: z.enum(EUserRole),
  password: z.string().min(12).max(128),
});
export const SeedUsersSchema = z
  .array(SeedUserSchema)
  .min(1)
  .refine((users) => new Set(users.map((u) => u.email)).size === users.length, { error: 'SEED_USERS_JSON repite un correo' });
export type TSeedUser = z.output<typeof SeedUserSchema>;

/**
 * Variables de entorno validadas AL ARRANCAR: si falta o es inválida una, el proceso no levanta
 * (falla temprano con el detalle, en vez de romper en la primera request que la use).
 */
const DEV_SESSION_SECRET = 'dev-only-session-secret-change-me-please';
const DEV_TOTP_KEY = 'dev-only-totp-encryption-key-change-me-please';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Origen del front para CORS (sin proxy). */
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  /** Firma de la cookie de sesión. En production es OBLIGATORIO uno propio (>= 32 caracteres). */
  SESSION_SECRET: z.string().min(32).default(DEV_SESSION_SECRET),
  /**
   * Datos de DEMOSTRACIÓN (usuarios de desarrollo con contraseña conocida + tickets de ejemplo). Por defecto SÍ en
   * desarrollo y pruebas y NO en production: allí no debe existir ninguna cuenta con contraseña pública.
   */
  SEED_DEMO_DATA: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Cuentas iniciales por rol (JSON, ver `SeedUsersSchema`). Sin datos de demostración, es lo que siembra los usuarios. */
  SEED_USERS_JSON: z.string().optional(),
  /** Primer administrador cuando NO hay datos de demostración (production): la única cuenta con la que se entra al inicio. */
  BOOTSTRAP_ADMIN_EMAIL: z.email().default('admin@ticketit.local'),
  BOOTSTRAP_ADMIN_NAME: z.string().min(2).max(120).default('Administrador'),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
  /**
   * Persistencia del dominio con TypeORM (Postgres): `true` guarda y recupera usuarios, tickets, catálogos… de la base.
   * Por defecto, activa cuando hay `DATABASE_URL` (salvo en pruebas, que van en memoria a menos que se pida).
   */
  DB_PERSISTENCE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** Aplica las migraciones pendientes al arrancar (idempotente). Apágalo si las corre otro paso del despliegue. */
  DB_AUTO_MIGRATE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /** SOLO PRUEBAS: borra todo el esquema al conectar. Prohibido en production. */
  DB_RESET_ON_START: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Intentos fallidos SEGUIDOS de inicio de sesión que bloquean la cuenta hasta que un administrador la desbloquee. */
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  /** Clave con que se cifran en reposo los secretos TOTP (AES-256-GCM). En production es OBLIGATORIA una propia. */
  TOTP_ENCRYPTION_KEY: z.string().min(32).default(DEV_TOTP_KEY),
  /**
   * Redis (sesiones, rate limiting, tokens de un solo uso, pub/sub de SSE). Sin él se usa un
   * almacén EN MEMORIA (desarrollo y tests, un solo proceso); en production es OBLIGATORIO.
   */
  REDIS_URL: z.string().min(1).optional(),
  /** Postgres (auditoría persistente). Sin él, el registro vive en memoria y se pierde al reiniciar. */
  DATABASE_URL: z.string().min(1).optional(),
  /**
   * Prefijo de TODAS las claves en Redis (sesiones, contadores, tokens): varios entornos (o varias apps)
   * pueden compartir un Redis sin pisarse, y los tests e2e usan uno distinto por prueba.
   */
  REDIS_KEY_PREFIX: z.string().min(1).max(60).default('ticketit:'),
  /** Origen PÚBLICO del front: base de los enlaces de los correos (`/verify-email?token=…`). */
  APP_URL: z.string().url().default('http://localhost:4200'),
  /** Tope global por IP (req/min). Cada ruta puede ajustarlo con `@RateLimit()`. */
  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().min(1).default(300),
  /** Detrás de proxy (Caddy/Traefik): `req.ip` es la IP real y la cookie `Secure` funciona. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /**
   * Bucket S3-compatible (MinIO) donde vive la EVIDENCIA de los tickets (imágenes, PDF, Excel, CSV y videos cortos).
   * Sin `S3_ENDPOINT` se usa memoria (desarrollo y pruebas); en production es OBLIGATORIO.
   */
  S3_ENDPOINT: z.string().min(1).optional(),
  S3_PORT: z.coerce.number().int().min(1).max(65535).default(9000),
  S3_USE_SSL: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(3).max(63).default('ticketit-evidence'),
  S3_REGION: z.string().min(1).optional(),
  /** Scalar UI (/api/reference) + OpenAPI JSON — apagado por defecto en producción. */
  API_DOCS_ENABLED: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type TEnv = z.output<typeof EnvSchema>;

/** Las cuentas iniciales declaradas en `SEED_USERS_JSON` (lista vacía si no hay). Lanza si el JSON es inválido. */
export function parseSeedUsers(raw: string | undefined): TSeedUser[] {
  if (!raw?.trim()) return [];
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('SEED_USERS_JSON no es un JSON válido.');
  }
  const parsed = SeedUsersSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`SEED_USERS_JSON inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  return parsed.data;
}

/** ¿Se guarda el dominio en Postgres con TypeORM? Hay `DATABASE_URL` y no es un NODE_ENV=test sin pedirlo expresamente. */
export const persistenceEnabled = (env: Pick<TEnv, 'NODE_ENV' | 'DATABASE_URL' | 'DB_PERSISTENCE'>): boolean =>
  !!env.DATABASE_URL && (env.DB_PERSISTENCE ?? env.NODE_ENV !== 'test');

/** ¿Se siembran los datos de demostración? Sí salvo en production (donde hay que pedirlo con `SEED_DEMO_DATA=true`). */
export const seedDemoData = (env: Pick<TEnv, 'NODE_ENV' | 'SEED_DEMO_DATA'>): boolean => env.SEED_DEMO_DATA ?? env.NODE_ENV !== 'production';

export function loadEnv(source: NodeJS.ProcessEnv = process.env): TEnv {
  const env = EnvSchema.parse(source);
  if (env.NODE_ENV === 'production' && env.DB_RESET_ON_START) {
    throw new Error('DB_RESET_ON_START borra la base: está prohibido en production.');
  }
  if (env.NODE_ENV === 'production' && env.DB_PERSISTENCE === false) {
    throw new Error('En production el dominio debe persistirse: no uses DB_PERSISTENCE=false.');
  }
  if (env.NODE_ENV === 'production' && (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY)) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY y S3_SECRET_KEY son obligatorios en production (la evidencia vive en el bucket).');
  }
  if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
    throw new Error('DATABASE_URL es obligatorio en production (los datos se guardan en Postgres).');
  }
  if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEV_SESSION_SECRET) {
    throw new Error('SESSION_SECRET es obligatorio en production (no usar el de desarrollo).');
  }
  if (env.NODE_ENV === 'production' && env.TOTP_ENCRYPTION_KEY === DEV_TOTP_KEY) {
    throw new Error('TOTP_ENCRYPTION_KEY es obligatorio en production (no usar el de desarrollo).');
  }
  if (env.NODE_ENV === 'production' && !seedDemoData(env)) {
    const seeded = parseSeedUsers(env.SEED_USERS_JSON);
    if (!env.BOOTSTRAP_ADMIN_PASSWORD && !seeded.some((user) => user.role === EUserRole.ADMIN)) {
      throw new Error('En production sin datos de demostración hace falta al menos un ADMIN: SEED_USERS_JSON (con un usuario ADMIN) o BOOTSTRAP_ADMIN_PASSWORD.');
    }
  }
  if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
    throw new Error('REDIS_URL es obligatorio en production (sesiones y rate limiting compartidos).');
  }
  return env;
}
