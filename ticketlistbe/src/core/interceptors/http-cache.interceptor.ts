import {
  HttpStatus,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { CACHE_TTL_KEY } from '../decorators/cache-ttl.decorator.js';
import { buildEtag, etagMatches } from '../utils/etag.util.js';

/**
 * Caché HTTP (RFC 9111) + validación condicional (RFC 9110 §13) — port de
 * `etag-cache.interceptor.ts` de wallet-api:
 *
 *  GET/HEAD con body →  `Cache-Control: private, max-age=<@CacheTtl | 0>` + `ETag`.
 *                       `private`: las respuestas dependen de la sesión (permisos, alcance por
 *                       fila); un caché compartido (proxy/CDN) jamás debe reusarlas para otro.
 *                       `If-None-Match` coincidente → 304 sin body.
 *  Mutaciones       →  `Cache-Control: no-store`: nunca se guarda una respuesta de escritura.
 *  Errores          →  `no-store` lo pone `CustomExceptionFilter`.
 *  `Vary: Cookie`   →  la representación depende de la cookie de sesión.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Cache-Control', 'no-store');
      return next.handle();
    }

    const ttl =
      this.reflector.getAllAndOverride<number | undefined>(CACHE_TTL_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 0;

    return next.handle().pipe(
      map((body: unknown) => {
        response.setHeader('Cache-Control', `private, max-age=${ttl}`);
        response.setHeader('Vary', 'Cookie, Accept-Language');
        if (body === undefined) return body;
        const etag = buildEtag(body);
        response.setHeader('ETag', etag);
        if (etagMatches(request.header('if-none-match'), etag)) {
          response.status(HttpStatus.NOT_MODIFIED);
          return undefined;
        }
        return body;
      }),
    );
  }
}
