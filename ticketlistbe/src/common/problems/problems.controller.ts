import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { ERROR_CODES } from '../codes/error-codes.js';
import type { IErrorDetail } from '../../core/interfaces/Icustom-code.interface.js';
import { Public } from '../../modules/auth/session/public.decorator.js';

const BY_CODE = new Map<string, IErrorDetail>(
  Object.values(ERROR_CODES).flatMap((entries) =>
    Object.values(entries as Record<string, IErrorDetail>).map((detail) => [detail.code, detail] as const),
  ),
);

/**
 * Hace DESREFERENCIABLE el miembro `type` de Problem Details (RFC 9457 §3.1.1: "when
 * dereferenced, it SHOULD provide human-readable documentation for the problem type").
 * `GET /api/problems/RTCK-E001` → entrada del catálogo. Público: documenta, no expone datos.
 */
@ApiTags('Problems (RFC 9457)')
@Public()
@Controller('problems')
export class ProblemsController {
  @Get()
  list(): IErrorDetail[] {
    return [...BY_CODE.values()];
  }

  @Get(':code')
  @ApiParam({ name: 'code', example: 'CVAL-E001' })
  findOne(@Param('code') code: string): IErrorDetail & { docs: string } {
    const detail = BY_CODE.get(code);
    if (!detail) throw new NotFoundException(`Código de problema desconocido: ${code}`);
    return { ...detail, docs: `docs/standard/error-catalog.md#${code.toLowerCase()}` };
  }
}
