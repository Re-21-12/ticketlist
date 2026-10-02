import type * as z from 'zod';
import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { RateLimit } from '../../core/rate-limit/rate-limit.decorator.js';
import {
  AccountMessageSchema,
  EmailOnlyDto,
  EmailOnlySchema,
  RecoverPasswordDto,
  RecoverPasswordSchema,
  ResetPasswordDto,
  ResetPasswordSchema,
  SignUpDto,
  SignUpSchema,
  VerifyEmailDto,
  VerifyEmailSchema,
  type TAccountMessage,
} from './dtos/account-recovery.dto.js';
import { AccountRecoveryService } from './session/account-recovery.service.js';
import { Public } from './session/public.decorator.js';

/**
 * Alta de cuenta y recuperación: PÚBLICOS (no hay sesión todavía; por eso tampoco CSRF). Todo se limita
 * por IP aquí y, en `forgot`/`resend`, además por correo en el servicio.
 */
@ApiTags('Account recovery')
@Public()
@Controller('auth')
export class AccountRecoveryController {
  constructor(private readonly recovery: AccountRecoveryService) {}

  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ limit: 10, windowSeconds: 3600 })
  @ApiZodBody(SignUpSchema)
  @ApiZodResponse(201, AccountMessageSchema, 'Cuenta creada; falta verificar el correo')
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos / contraseña débil')
  @ApiProblemResponse(409, 'SUSR-E001 · Ya existe una cuenta con ese correo')
  @ApiProblemResponse(429, 'SRTL-E001 · Demasiados intentos')
  signUp(@Body() dto: SignUpDto): Promise<TAccountMessage> {
    return this.recovery.signUp(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 20, windowSeconds: 900 })
  @ApiZodBody(VerifyEmailSchema)
  @ApiResponse({ status: 204, description: 'Correo verificado' })
  @ApiProblemResponse(400, 'SAUT-E009 · El enlace venció o ya se usó')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<void> {
    await this.recovery.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 5, windowSeconds: 3600 })
  @ApiZodBody(EmailOnlySchema)
  @ApiZodResponse(200, AccountMessageSchema, 'Mismo mensaje exista o no la cuenta')
  @ApiProblemResponse(429, 'SRTL-E001 · 3 reenvíos por hora por correo')
  resendVerification(@Body() dto: EmailOnlyDto): Promise<TAccountMessage> {
    return this.recovery.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ limit: 10, windowSeconds: 900 })
  @ApiZodBody(EmailOnlySchema)
  @ApiZodResponse(200, AccountMessageSchema, 'Mismo mensaje exista o no la cuenta (anti-enumeración)')
  @ApiProblemResponse(429, 'SRTL-E001 · 5 solicitudes por 15 min por correo')
  forgotPassword(@Body() dto: EmailOnlyDto): Promise<TAccountMessage> {
    return this.recovery.forgotPassword(dto.email);
  }

  @Post('recover-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 10, windowSeconds: 900 })
  @ApiZodBody(RecoverPasswordSchema)
  @ApiResponse({ status: 204, description: 'Contraseña cambiada; todas las sesiones de la cuenta se cerraron' })
  @ApiProblemResponse(400, 'CVAL-E001 · Código mal formado o contraseña débil')
  @ApiProblemResponse(401, 'SAUT-E010 · Datos de verificación incorrectos (misma respuesta exista o no la cuenta)')
  @ApiProblemResponse(422, 'SAUT-E007 · La nueva es igual a la actual')
  @ApiProblemResponse(429, 'SRTL-E001 · 5 intentos fallidos por cuenta cada 15 min')
  async recoverPassword(@Body() dto: RecoverPasswordDto, @Req() req: Request): Promise<void> {
    await this.recovery.recoverPassword(dto as z.output<typeof RecoverPasswordSchema>, req);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimit({ limit: 10, windowSeconds: 900 })
  @ApiZodBody(ResetPasswordSchema)
  @ApiResponse({ status: 204, description: 'Contraseña cambiada; todas las sesiones de la cuenta se cerraron' })
  @ApiProblemResponse(400, 'SAUT-E009 · El enlace venció o ya se usó · CVAL-E001 · Contraseña débil')
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request): Promise<void> {
    await this.recovery.resetPassword(dto.token, dto.newPassword, req);
  }
}
