import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { ApiProblemResponse, ApiZodQuery, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import type { IAuditLog } from './audit-log.entity.js';
import { AUDIT_STORE, type IAuditLogStore } from './audit-log.store.js';
import {
  AuditLogPageSchema,
  AuditLogQueryDto,
  AuditLogQuerySchema,
  AuditLogResponseSchema,
} from './dtos/audit-log.dto.js';

const toResponse = (entry: IAuditLog): z.output<typeof AuditLogResponseSchema> =>
  AuditLogResponseSchema.parse({ ...entry, at: entry.at.toISOString() });

/** Registro de auditoría: SOLO lectura (no hay POST/PATCH/DELETE; el registro es inmutable). */
@ApiTags('Audit log')
@Controller('audit-logs')
export class AuditLogController {
  constructor(@Inject(AUDIT_STORE) private readonly audit: IAuditLogStore) {}

  @Get()
  @CheckAbility(EAbility.READ, 'AuditLog')
  @ApiZodQuery(AuditLogQuerySchema)
  @ApiZodResponse(200, AuditLogPageSchema)
  @ApiProblemResponse(403, 'SAUT-E001 · Solo administración consulta la auditoría')
  async list(@Query() query: AuditLogQueryDto): Promise<z.output<typeof AuditLogPageSchema>> {
    const [rows, total] = await this.audit.findAll({
      page: query.page,
      take: query.take,
      ...(query.search ? { search: query.search } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.outcome ? { outcome: query.outcome } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.actorUuid ? { actorUuid: query.actorUuid } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
    });
    return { data: rows.map(toResponse), meta: { total, page: query.page, take: query.take } };
  }

  @Get(':uuid')
  @ApiParam({ name: 'uuid', schema: { type: 'string', format: 'uuid' } })
  @CheckAbility(EAbility.READ, 'AuditLog')
  @ApiZodResponse(200, AuditLogResponseSchema)
  @ApiProblemResponse(403, 'SAUT-E001 · Solo administración consulta la auditoría')
  @ApiProblemResponse(404, 'SAUD-E001 · Entrada de auditoría no encontrada')
  async findOne(@Param() { uuid }: UuidParamDto): Promise<z.output<typeof AuditLogResponseSchema>> {
    const entry = await this.audit.findByUuid(uuid);
    if (!entry) throw new CustomBusinessException(ERROR_CODES.AUD.NOT_FOUND);
    return toResponse(entry);
  }
}
