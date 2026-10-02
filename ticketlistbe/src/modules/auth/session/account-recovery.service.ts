import { Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { APP_ENV } from '../../../config/config.module.js';
import type { TEnv } from '../../../config/env.schema.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { KV_STORE, type IKeyValueStore } from '../../../core/kv/kv-store.interface.js';
import { MAIL_SERVICE, type IMailService } from '../../../core/mail/mail.service.js';
import { RateLimitService, type IRateLimitRule } from '../../../core/rate-limit/rate-limit.service.js';
import { UsersRepository } from '../../users/users.repository.js';
import type { TAccountMessage } from '../dtos/account-recovery.dto.js';
import { SessionIndexService } from './session-index.service.js';

const VERIFY_PREFIX = 'verify:';
const RESET_PREFIX = 'reset:';
const VERIFY_TTL_SECONDS = 24 * 3600;
const RESET_TTL_SECONDS = 45 * 60;

/**
 * Alta de cuenta, verificación de correo y recuperación de contraseña (docs/design/auth-flows.md §1-2).
 *
 *  - Los tokens son 32 bytes aleatorios; en el almacén vive solo su HASH (`sha256`): si se filtra el
 *    almacén, los enlaces no sirven. Se consumen UNA vez (`getDel`) y vencen (24 h / 45 min).
 *  - `forgot-password` y `resend-verification` responden SIEMPRE lo mismo, exista o no la cuenta
 *    (anti-enumeración), y se limitan por correo además de por IP.
 *  - `devUrl` (el enlace del correo) solo se devuelve fuera de producción, para poder probar el flujo
 *    sin bandeja de entrada real.
 */
@Injectable()
export class AccountRecoveryService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rateLimit: RateLimitService,
    private readonly sessionIndex: SessionIndexService,
    @Inject(KV_STORE) private readonly kv: IKeyValueStore,
    @Inject(MAIL_SERVICE) private readonly mail: IMailService,
    @Inject(APP_ENV) private readonly env: TEnv,
  ) {}

  async signUp(dto: { name: string; email: string; password: string }): Promise<TAccountMessage> {
    if (this.usersRepository.emailExists(dto.email)) {
      throw new CustomBusinessException(ERROR_CODES.USR.EMAIL_TAKEN);
    }
    // Sin confirmación por correo: la cuenta queda activa y puede iniciar sesión de inmediato.
    this.usersRepository.create(dto);
    return this.reply('Cuenta creada. Ya puedes iniciar sesión.', undefined);
  }

  /** Consume el token y marca el correo como verificado. 400 `SAUT-E009` si venció o ya se usó. */
  async verifyEmail(token: string): Promise<void> {
    const userUuid = await this.kv.getDel(VERIFY_PREFIX + hashToken(token));
    if (!userUuid) throw new CustomBusinessException(ERROR_CODES.AUT.TOKEN_INVALID);
    this.usersRepository.markEmailVerified(userUuid);
  }

  async resendVerification(email: string): Promise<TAccountMessage> {
    await this.throttle(`resend:acct:${email}`, 3, 3600);
    const user = this.usersRepository.findByEmail(email);
    const link =
      user && !this.usersRepository.isEmailVerified(user.uuid)
        ? await this.sendVerification(user.uuid, user.email, user.name)
        : undefined;
    return this.reply('Si la cuenta existe y falta verificarla, te enviamos un nuevo enlace.', link);
  }

  async forgotPassword(email: string): Promise<TAccountMessage> {
    await this.throttle(`forgot:acct:${email}`, 5, 900);
    const user = this.usersRepository.findByEmail(email);
    let link: string | undefined;
    if (user) {
      const token = await this.issueToken(RESET_PREFIX, user.uuid, RESET_TTL_SECONDS);
      link = `${this.env.APP_URL}/reset-password?token=${token}`;
      await this.mail.send({
        to: user.email,
        subject: 'Restablece tu contraseña de Ticketit',
        text: `Hola ${user.name}: usa este enlace para elegir una contraseña nueva. Vence en 45 minutos. Si no lo pediste, ignora este correo.`,
        link,
      });
    }
    return this.reply('Si el correo existe, te enviamos un enlace para restablecer tu contraseña.', link);
  }

  /**
   * Fija la contraseña nueva y cierra TODAS las sesiones de la cuenta (quien completó el reset pudo no
   * ser el dueño de las sesiones abiertas). Completar el reset prueba que controla el correo, así que
   * también lo da por verificado.
   */
  async resetPassword(token: string, newPassword: string, req: Request): Promise<void> {
    const userUuid = await this.kv.getDel(RESET_PREFIX + hashToken(token));
    if (!userUuid) throw new CustomBusinessException(ERROR_CODES.AUT.TOKEN_INVALID);
    this.usersRepository.setPassword(userUuid, newPassword);
    this.usersRepository.markEmailVerified(userUuid);
    // `currentSid` vacío: ninguna sesión es «la actual», se cierran todas.
    await this.sessionIndex.revokeOthers(userUuid, '', req.sessionStore);
  }

  /**
   * Restablece la contraseña con un SEGUNDO FACTOR en lugar del enlace del correo: el código TOTP o la
   * contraseña actual. Cualquier fallo (cuenta inexistente, sin autenticador, código o clave mal) da la MISMA
   * respuesta (`SAUT-E010`), y se limita por cuenta: no se enumeran cuentas ni se prueban claves.
   * La persona elige la contraseña nueva; se cierran todas sus sesiones.
   */
  async recoverPassword(
    dto:
      | { method: 'totp'; email: string; code: string; newPassword: string }
      | { method: 'current_password'; email: string; currentPassword: string; newPassword: string },
    req: Request,
  ): Promise<void> {
    const rule: IRateLimitRule = { key: `recover:acct:${dto.email}`, limit: 5, windowSeconds: 900 };
    await this.rateLimit.assertAllowed(rule);

    const user = this.usersRepository.findByEmail(dto.email);
    let verified = false;
    // Una cuenta bloqueada no se recupera por aquí: solo un administrador la desbloquea.
    if (this.usersRepository.isLocked(dto.email)) {
      await this.rateLimit.recordFailure(rule);
      throw new CustomBusinessException(ERROR_CODES.AUT.RECOVERY_INVALID);
    }
    if (dto.method === 'totp') {
      verified = !!user && this.usersRepository.consumeTotp(user.uuid, dto.code, Date.now());
    } else {
      // `verifyCredentials` gasta el mismo tiempo exista o no la cuenta.
      verified = !!this.usersRepository.verifyCredentials(dto.email, dto.currentPassword);
      if (verified && dto.newPassword === dto.currentPassword) {
        throw new CustomBusinessException(ERROR_CODES.AUT.PASSWORD_UNCHANGED);
      }
    }
    if (!verified || !user) {
      await this.rateLimit.recordFailure(rule);
      throw new CustomBusinessException(ERROR_CODES.AUT.RECOVERY_INVALID);
    }

    this.usersRepository.setPassword(user.uuid, dto.newPassword);
    await this.rateLimit.reset(rule);
    await this.sessionIndex.revokeOthers(user.uuid, '', req.sessionStore);
  }

  private async sendVerification(userUuid: string, email: string, name: string): Promise<string> {
    const token = await this.issueToken(VERIFY_PREFIX, userUuid, VERIFY_TTL_SECONDS);
    const link = `${this.env.APP_URL}/verify-email?token=${token}`;
    await this.mail.send({
      to: email,
      subject: 'Verifica tu correo en Ticketit',
      text: `Hola ${name}: confirma tu correo con este enlace. Vence en 24 horas.`,
      link,
    });
    return link;
  }

  private async issueToken(prefix: string, userUuid: string, ttlSeconds: number): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.kv.set(prefix + hashToken(token), userUuid, ttlSeconds);
    return token;
  }

  private async throttle(key: string, limit: number, windowSeconds: number): Promise<void> {
    const rule: IRateLimitRule = { key, limit, windowSeconds };
    const state = await this.rateLimit.consume(rule);
    if (!state.allowed) throw await this.rateLimit.tooMany(rule, state);
  }

  private reply(message: string, link: string | undefined): TAccountMessage {
    return { message, ...(link && this.env.NODE_ENV !== 'production' ? { devUrl: link } : {}) };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
