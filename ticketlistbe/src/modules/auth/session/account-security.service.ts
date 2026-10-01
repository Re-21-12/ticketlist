import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ERROR_CODES } from '../../../common/codes/error-codes.js';
import { CustomBusinessException } from '../../../core/exceptions/app.exception.js';
import { RateLimitService, type IRateLimitRule } from '../../../core/rate-limit/rate-limit.service.js';
import { UsersRepository } from '../../users/users.repository.js';
import { SessionIndexService } from './session-index.service.js';
import type { ISessionUser } from './session-user.interface.js';

/** 5 contraseñas actuales equivocadas por cuenta cada 15 min (frena probar claves con una sesión robada). */
const CHANGE_PASSWORD_LIMIT = { limit: 5, windowSeconds: 900 } as const;

/** Seguridad de la propia cuenta: cambio de contraseña y cierre de otras sesiones. */
@Injectable()
export class AccountSecurityService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rateLimit: RateLimitService,
    private readonly sessionIndex: SessionIndexService,
  ) {}

  /**
   * Cambia la contraseña y cierra TODAS las demás sesiones: quien tenga una sesión abierta con la
   * clave vieja (quizá un atacante) queda fuera. La sesión actual sigue abierta.
   */
  async changePassword(
    user: ISessionUser,
    req: Request,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const rule: IRateLimitRule = { key: `pwd-change:${user.uuid}`, ...CHANGE_PASSWORD_LIMIT };
    await this.rateLimit.assertAllowed(rule);

    if (!this.usersRepository.verifyPassword(user.uuid, dto.currentPassword)) {
      await this.rateLimit.recordFailure(rule);
      throw new CustomBusinessException(ERROR_CODES.AUT.CURRENT_PASSWORD_INVALID);
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new CustomBusinessException(ERROR_CODES.AUT.PASSWORD_UNCHANGED);
    }

    this.usersRepository.setPassword(user.uuid, dto.newPassword);
    await this.rateLimit.reset(rule);
    await this.sessionIndex.revokeOthers(user.uuid, req.sessionID, req.sessionStore);
  }
}
