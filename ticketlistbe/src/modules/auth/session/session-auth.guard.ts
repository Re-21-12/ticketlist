import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { RequestContext } from '../../../core/context/request-context.js';
import { UsersRepository } from '../../users/users.repository.js';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from './allow-password-change-pending.decorator.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { SESSION_ABSOLUTE_MAX_MS } from './session.constants.js';

/**
 * Guard GLOBAL de autenticación (como `SessionAuthGuard` de wallet-api):
 *  - sin sesión → 401 `SAUT-E002`
 *  - más de 7 días desde el login (tope absoluto aunque haya actividad) → se destruye, 401 `SAUT-E005`
 *  - contraseña temporal pendiente de cambio → 403 `SAUT-E015` salvo en lo marcado `@AllowPasswordChangePending()`
 * `@Public()` lo salta (login, catálogo de problemas).
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersRepository: UsersRepository,
  ) {}

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
    const pending = this.usersRepository.passwordChangeState(request.session.userUuid);
    if (pending.required) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_PENDING_KEY, [context.getHandler(), context.getClass()]);
      if (pending.expired) {
        await new Promise<void>((resolve) => request.session.destroy(() => resolve()));
        throw new CustomBusinessException(ERROR_CODES.AUT.TEMP_PASSWORD_EXPIRED);
      }
      if (!allowed) throw new CustomBusinessException(ERROR_CODES.AUT.PASSWORD_CHANGE_REQUIRED);
    }
    return true;
  }
}
