import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { RateLimitService, type IRateLimitRule } from '../../../core/rate-limit/rate-limit.service.js';
import { APP_ENV } from '../../../config/config.module.js';
import type { TEnv } from '../../../config/env.schema.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { EUserRole } from '../casl/ability.enum.js';
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
    private readonly rateLimit: RateLimitService,
    private readonly notifications: NotificationsService,
    @Inject(APP_ENV) private readonly env: TEnv,
  ) {}

  async signIn(req: Request, res: Response, email: string, password: string): Promise<ISessionUser> {
    // 10 intentos FALLIDOS por correo cada 15 min (frena adivinar una contraseña desde muchas IPs).
    // Se cuenta por el correo que se INTENTÓ, exista o no: así el límite no revela qué cuentas existen.
    const rule: IRateLimitRule = { key: `login:acct:${email.toLowerCase()}`, limit: 10, windowSeconds: 900 };
    await this.rateLimit.assertAllowed(rule);

    // Cuenta bloqueada: ni siquiera se mira la contraseña. Solo un administrador la desbloquea (CU07, A3).
    if (this.usersRepository.isLocked(email)) throw this.lockedError();

    const user = this.usersRepository.verifyCredentials(email, password);
    if (!user) {
      await this.rateLimit.recordFailure(rule);
      // El intento que alcanza el máximo BLOQUEA la cuenta (si existe) y avisa a los administradores.
      if (this.usersRepository.registerFailedLogin(email, this.env.LOGIN_MAX_ATTEMPTS)) {
        this.notifyAdmins(email);
        throw this.lockedError();
      }
      throw new CustomBusinessException(ERROR_CODES.AUT.INVALID_CREDENTIALS);
    }
    this.usersRepository.clearFailedLogins(user.uuid);
    // Recién DESPUÉS de acertar la contraseña se dice que falta verificar: quien no la sabe no aprende nada.
    if (!this.usersRepository.isEmailVerified(user.uuid)) {
      throw new CustomBusinessException(ERROR_CODES.AUT.EMAIL_NOT_VERIFIED);
    }
    await this.rateLimit.reset(rule);

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

  /** 423 con la información de contacto de la administración (a quién pedirle el desbloqueo). */
  private lockedError(): CustomBusinessException {
    const contacts = this.usersRepository.listByRole(EUserRole.ADMIN).map(({ name, email }) => ({ name, email }));
    return new CustomBusinessException(ERROR_CODES.AUT.ACCOUNT_LOCKED, { contacts });
  }

  private notifyAdmins(email: string): void {
    for (const admin of this.usersRepository.listByRole(EUserRole.ADMIN)) {
      this.notifications.notify({
        recipientUuid: admin.uuid,
        type: 'ACCOUNT_LOCKED',
        message: `La cuenta ${email} se bloqueó por intentos fallidos de inicio de sesión. Desbloquéala en Usuarios si se comunicó contigo`,
        resourceType: null,
        resourceUuid: null,
      });
    }
  }

  async signOut(req: Request, res: Response): Promise<void> {
    if (req.session.userUuid) await this.sessionIndex.untrack(req.session.userUuid, req.sessionID);
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE, { path: COOKIE_PATH });
    res.clearCookie(XSRF_COOKIE, { path: '/' });
  }
}
