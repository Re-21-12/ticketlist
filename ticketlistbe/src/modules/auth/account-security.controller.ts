import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import { ChangePasswordDto, ChangePasswordSchema } from './dtos/change-password.dto.js';
import { SessionListSchema, type TSessionInfo } from './dtos/session-info.dto.js';
import { AccountSecurityService } from './session/account-security.service.js';
import { SessionIndexService } from './session/session-index.service.js';
import type { ISessionUser } from './session/session-user.interface.js';

/**
 * Seguridad de la PROPIA cuenta (pestaña «Seguridad» y «Sesiones» del perfil). Solo opera sobre el
 * usuario de la sesión: ningún endpoint recibe un `userUuid`, así que no se puede tocar la cuenta de
 * otra persona. Requiere sesión y CSRF (guards globales); sin `@CheckAbility`: todo usuario autenticado
 * gestiona la suya.
 */
@ApiTags('Account security')
@Controller('auth')
export class AccountSecurityController {
  constructor(
    private readonly security: AccountSecurityService,
    private readonly sessionIndex: SessionIndexService,
  ) {}

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Por IP además del límite por cuenta del servicio: frena una ráfaga repartida entre cuentas.
  @RateLimit({ limit: 20, windowSeconds: 900 })
  @ApiZodBody(ChangePasswordSchema)
  @ApiResponse({ status: 204, description: 'Contraseña cambiada; las demás sesiones se cerraron' })
  @ApiProblemResponse(400, 'CVAL-E001 · Contraseña débil o campos inválidos')
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  @ApiProblemResponse(422, 'SAUT-E006 · La actual no es correcta · SAUT-E007 · Igual a la actual')
  @ApiProblemResponse(429, 'SRTL-E001 · Demasiados intentos fallidos')
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request): Promise<void> {
    await this.security.changePassword(this.me(), req, dto);
  }

  @Get('sessions')
  @ApiZodResponse(200, SessionListSchema)
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  async listSessions(@Req() req: Request): Promise<{ data: TSessionInfo[] }> {
    return { data: await this.sessionIndex.listFor(this.me().uuid, req.sessionID, req.sessionStore) };
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Todas las sesiones salvo la actual quedaron cerradas' })
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  async revokeOthers(@Req() req: Request): Promise<void> {
    await this.sessionIndex.revokeOthers(this.me().uuid, req.sessionID, req.sessionStore);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', description: 'Id público de la sesión (no es el `sid` de la cookie)' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  @ApiProblemResponse(404, 'RSES-E001 · No existe o no es tuya')
  @ApiProblemResponse(422, 'SSES-E001 · Es la sesión actual: usa cerrar sesión')
  async revokeSession(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.sessionIndex.revoke(this.me().uuid, id, req.sessionID, req.sessionStore);
  }

  private me(): ISessionUser {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return user;
  }
}
