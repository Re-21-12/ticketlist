import { Inject, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { APP_ENV } from '../../config/config.module.js';
import type { TEnv } from '../../config/env.schema.js';

export const REQUEST_ID_HEADER = 'x-request-id';
/** Solo se acepta un id entrante con esta forma: nunca se refleja texto arbitrario en logs/headers. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Observabilidad por request (docs/standard/observability.md):
 *  - `X-Request-Id`: se respeta el que manda el proxy/cliente si es válido; si no, se genera.
 *    Va en la respuesta (el front lo muestra al reportar un error) y en TODA línea de log.
 *  - Una línea de log JSON por request al TERMINAR (`finish`): como es un middleware también
 *    registra lo que corta un guard (401, 403, 429) — un interceptor no lo vería.
 *
 * Nunca se loguea la query ni el body: pueden traer tokens o datos personales.
 */
@Injectable()
export class RequestObservabilityMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(@Inject(APP_ENV) private readonly env: TEnv) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    // Se reescribe el header de la request: el resto del código lo lee de ahí.
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (this.env.NODE_ENV === 'test') return next();
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const status = res.statusCode;
      const line = JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
        durationMs: Math.round(Number(process.hrtime.bigint() - start) / 1e5) / 10,
        userUuid: req.session?.userUuid ?? null,
      });
      if (status >= 500) this.logger.error(line);
      else if (status >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
