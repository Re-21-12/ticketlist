import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { RequestContext } from '../../../core/context/request-context.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SESSION_ABSOLUTE_MAX_MS } from './session.constants.js';

/**
 * Guard GLOBAL de autenticación (como `SessionAuthGuard` de wallet-api):
 *  - sin sesión → 401 `SAUT-E002`
 *  - más de 7 días desde el login (tope absoluto aunque haya actividad) → se destruye, 401 `SAUT-E005`
 * `@Public()` lo salta (login, catálogo de problemas).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (!RequestContext.currentUser() || !request.session.userUuid) {
      throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    }
    if (Date.now() - (request.session.authenticatedAt ?? 0) > SESSION_ABSOLUTE_MAX_MS) {
      await new Promise<void>((resolve) => request.session.destroy(() => resolve()));
      throw new CustomBusinessException(ERROR_CODES.AUT.SESSION_EXPIRED);
    }
    return true;
  }
}
