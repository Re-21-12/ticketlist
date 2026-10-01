import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ShellResponseSchema, type TShellResponse } from '../../bff/shell/dtos/shell-response.dto.js';
import { ShellService } from '../../bff/shell/shell.service.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { RequestContext } from '../../core/context/request-context.js';
import { SignInDto, SignInSchema } from './dtos/sign-in.dto.js';
import { AuthSessionService } from './session/auth-session.service.js';
import { Public } from './session/public.decorator.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly shellService: ShellService,
  ) {}

  /**
   * Inicia sesión: `Set-Cookie: sid` (HttpOnly) + `XSRF-TOKEN`. Responde el shell del BFF para que
   * el front no necesite una segunda llamada.
   */
  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(SignInSchema)
  @ApiZodResponse(200, ShellResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(401, 'SAUT-E004 · Credenciales inválidas')
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TShellResponse> {
    const user = await this.authSessionService.signIn(req, res, dto.email, dto.password);
    // El contexto de esta request se creó sin sesión: se reconstruye con el usuario recién autenticado.
    return RequestContext.run({ user, ifMatch: null }, () => this.shellService.getShell());
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiResponse({ status: 204, description: 'Sesión destruida y cookies borradas' })
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  @ApiProblemResponse(403, 'SAUT-E003 · Token CSRF inválido')
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.authSessionService.signOut(req, res);
  }
}
