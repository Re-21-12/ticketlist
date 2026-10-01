import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { XSRF_COOKIE, XSRF_HEADER } from './session.constants.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF double-submit cookie (OWASP; mismo patrón que wallet-api): en todo método NO seguro, el
 * header `X-XSRF-TOKEN` debe coincidir con la cookie `XSRF-TOKEN` que emite el login. Un sitio
 * atacante puede hacer que el navegador ENVÍE la cookie, pero no puede LEERLA para copiarla al
 * header. Angular `HttpClient` lo hace solo. Comparación en tiempo constante. `@Public()` (login)
 * queda exento: todavía no hay sesión.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const cookie = (request.cookies as Record<string, string> | undefined)?.[XSRF_COOKIE] ?? '';
    const header = request.header(XSRF_HEADER) ?? '';
    const valid =
      cookie.length > 0 &&
      cookie.length === header.length &&
      timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
    if (!valid) throw new CustomBusinessException(ERROR_CODES.AUT.CSRF_MISMATCH);
    return true;
  }
}
