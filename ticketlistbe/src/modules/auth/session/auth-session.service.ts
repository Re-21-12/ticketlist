import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { UsersRepository } from '../../users/users.repository.js';
import { SessionIndexService } from './session-index.service.js';
import type { ISessionUser } from './session-user.interface.js';
import {
  COOKIE_PATH,
  SESSION_ABSOLUTE_MAX_MS,
  SESSION_COOKIE,
  XSRF_COOKIE,
} from './session.constants.js';

/**
 * Ciclo de vida de la sesión stateful (equivale a `AuthSessionService.completeAuthentication`
 * de wallet-api): único punto donde se crea y se destruye una sesión.
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionIndex: SessionIndexService,
  ) {}

  async signIn(req: Request, res: Response, email: string, password: string): Promise<ISessionUser> {
    const user = this.usersRepository.verifyCredentials(email, password);
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.INVALID_CREDENTIALS);

    // Fijación de sesión (OWASP): un id previo (quizá plantado por un atacante) NUNCA pasa a
    // estar autenticado — se emite uno nuevo al autenticar.
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error: unknown) => (error ? reject(error) : resolve())),
    );
    req.session.userUuid = user.uuid;
    req.session.authenticatedAt = Date.now();
    req.session.ip = req.ip ?? 'desconocida';
    req.session.userAgent = (req.header('user-agent') ?? '').slice(0, 300);
    await this.sessionIndex.track(user.uuid, req.sessionID);

    // Token CSRF nuevo en CADA login (un token de una sesión anterior deja de servir).
    res.cookie(XSRF_COOKIE, randomBytes(32).toString('base64url'), {
      httpOnly: false, // a propósito: el front debe leerlo para copiarlo al header
      sameSite: 'lax',
      secure: req.secure,
      path: '/',
      maxAge: SESSION_ABSOLUTE_MAX_MS,
    });
    return user;
  }

  async signOut(req: Request, res: Response): Promise<void> {
    if (req.session.userUuid) await this.sessionIndex.untrack(req.session.userUuid, req.sessionID);
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE, { path: COOKIE_PATH });
    res.clearCookie(XSRF_COOKIE, { path: '/' });
  }
}
