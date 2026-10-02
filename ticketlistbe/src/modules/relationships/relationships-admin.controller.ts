import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as z from 'zod';
import { ApiProblemResponse, ApiZodQuery, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import {
  RelationshipAdminPageSchema,
  RelationshipAdminQueryDto,
  RelationshipAdminQuerySchema,
} from './dtos/relationship-admin.dto.js';
import { RelationshipsService } from './relationships.service.js';

const E403 = [403, 'SAUT-E001 · Solo administración ve todas las relaciones'] as const;

/**
 * Administración de relaciones (pantalla «Relaciones» de wallet-api: `relation-permissions`). Exige
 * `manage Relationship`: lo tiene ADMIN (`manage all`); un titular común solo gestiona las SUYAS
 * desde `/api/relationships`.
 */
@ApiTags('Relationships · Administración')
@Controller('relationships/admin')
export class RelationshipsAdminController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Get()
  @CheckAbility(EAbility.MANAGE, 'Relationship')
  @ApiZodQuery(RelationshipAdminQuerySchema)
  @ApiZodResponse(200, RelationshipAdminPageSchema)
  @ApiProblemResponse(...E403)
  list(@Query() query: RelationshipAdminQueryDto): z.output<typeof RelationshipAdminPageSchema> {
    return this.relationshipsService.listAll(query);
  }

  /** Revoca cualquier relación activa; conserva el historial y avisa a las dos personas. */
  @Delete(':uuid')
  @ApiParam({ name: 'uuid', schema: { type: 'string', format: 'uuid' } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.MANAGE, 'Relationship')
  @ApiResponse({ status: 204, description: 'Relación revocada' })
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RREL-E001 · Relación no encontrada o ya revocada')
  revoke(@Param() { uuid }: UuidParamDto): Promise<void> {
    return this.relationshipsService.revokeAsAdmin(uuid);
  }
}
