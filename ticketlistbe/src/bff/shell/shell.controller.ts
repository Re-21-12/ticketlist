import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiProblemResponse, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { ShellResponseSchema, type TShellResponse } from './dtos/shell-response.dto.js';
import { ShellService } from './shell.service.js';

@ApiTags('BFF')
@Controller('bff/shell')
export class ShellController {
  constructor(private readonly shellService: ShellService) {}

  /** Usuario de la SESIÓN + reglas CASL resueltas + menú. Sin sesión → 401. */
  @Get()
  @ApiZodResponse(200, ShellResponseSchema)
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión · SAUT-E005 · Sesión expirada')
  getShell(): TShellResponse {
    return this.shellService.getShell();
  }
}
