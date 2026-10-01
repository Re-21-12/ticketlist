import type { INestApplication } from '@nestjs/common';
import type { TEnv } from './env.schema.js';
import { setupApiDocs } from './openapi.config.js';
import { setupSession } from './session.config.js';

/**
 * Configuración HTTP común a `main.ts` y a los e2e (así los tests prueban la MISMA app:
 * prefijo, CORS, sesión/cookies y documentación).
 */
export function configureApp(app: INestApplication, env: TEnv): void {
  // Mismo prefijo que consume el front (`/api/tickets`, `/api/bff/*`).
  app.setGlobalPrefix('api');
  // Con cookies de sesión: origen explícito + credentials (nunca `*`).
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  setupSession(app, env);
  // Referencia de la API (Scalar) — apagada por defecto en producción (API_DOCS_ENABLED).
  if (env.API_DOCS_ENABLED ?? env.NODE_ENV !== 'production') setupApiDocs(app);
}
