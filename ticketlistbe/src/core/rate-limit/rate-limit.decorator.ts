import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export const SKIP_RATE_LIMIT_KEY = 'skipRateLimit';

export interface IRateLimitOptions {
  /** Intentos por ventana, por IP. */
  limit: number;
  windowSeconds: number;
}

/**
 * Límite PROPIO de una ruta (más estricto que el global). Se cuenta por IP + ruta:
 * `@RateLimit({ limit: 5, windowSeconds: 900 })` en `forgot-password`.
 */
export const RateLimit = (options: IRateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

/** Sin límite por IP (health checks del orquestador). */
export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_KEY, true);
