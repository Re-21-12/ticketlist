import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { RedisStore } from 'connect-redis';
import session from 'express-session';
import { KV_STORE, type IKeyValueStore } from '../core/kv/kv-store.interface.js';
import { RedisKvStore } from '../core/kv/redis-kv.store.js';
import {
  COOKIE_PATH,
  SESSION_COOKIE,
  SESSION_IDLE_TIMEOUT_MS,
} from '../modules/auth/session/session.constants.js';
import type { TEnv } from './env.schema.js';

type TRedisStoreClient = ConstructorParameters<typeof RedisStore>[0]['client'];

/** `connect-redis` tipa su cliente con genéricos distintos a los de `redis` (mismo objeto en runtime). */
function sessionStore(kv: RedisKvStore): RedisStore {
  return new RedisStore({ client: kv.client as unknown as TRedisStoreClient, prefix: `${kv.prefix}sess:` });
}

/**
 * Sesión STATEFUL (RFC 6265) — mismo modelo que wallet-api (`session.config.ts`): el estado vive
 * en el servidor, la cookie `sid` solo transporta un id opaco.
 *
 * Store: con `REDIS_URL`, Redis (`connect-redis`, prefijo `ticketit:sess:`): sobrevive a reinicios y
 * se comparte entre réplicas. Sin él, `MemoryStore` (desarrollo/test, un solo proceso). `loadEnv()`
 * exige `REDIS_URL` y un `SESSION_SECRET` propio en production.
 *
 * Atributos de la cookie (docs/standard/cookies-session.md):
 *   HttpOnly     → no legible desde JS (mitiga robo por XSS)
 *   SameSite=Lax → no viaja en POST/PATCH/DELETE cross-site (mitiga CSRF, junto al double-submit)
 *   Secure       → solo HTTPS, en producción
 *   Path=/api    → solo se envía a la API
 *   Max-Age 30 min + rolling → expiración por inactividad deslizante
 */
export function setupSession(app: INestApplication, env: TEnv): void {
  const isProd = env.NODE_ENV === 'production';
  if (env.TRUST_PROXY ?? isProd) app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const kv = app.get<IKeyValueStore>(KV_STORE);
  app.use(cookieParser());
  app.use(
    session({
      store: kv instanceof RedisKvStore ? sessionStore(kv) : undefined,
      name: SESSION_COOKIE,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: COOKIE_PATH,
        maxAge: SESSION_IDLE_TIMEOUT_MS,
      },
    }),
  );
}
