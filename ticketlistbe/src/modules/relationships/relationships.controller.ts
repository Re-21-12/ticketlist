import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as z from 'zod';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { CreateRelationshipDto, UpdateRelationshipGrantsDto } from './dtos/relationship.dtos.js';
import { RelationshipsService } from './relationships.service.js';
import {
  RelationshipCreateSchema,
  RelationshipGrantsUpdateSchema,
  RelationshipResponseSchema,
} from './schemas/relationship.schema.js';

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
type TRelationshipResponse = z.output<typeof RelationshipResponseSchema>;

/**
 * «Compartir mis tickets» (pantalla del Titular en wallet-api: `/sharing`). Cualquier usuario
 * autenticado es titular de SUS tickets; las reglas por fila las valida el servicio.
 */
@ApiTags('Relationships (Titular/Alternante)')
@Controller('relationships')
export class RelationshipsController {
  constructor(private readonly relationshipsService: RelationshipsService) {}

  @Get()
  @CheckAbility(EAbility.READ, 'Relationship')
  @ApiZodResponse(200, z.array(RelationshipResponseSchema))
  listMine(): TRelationshipResponse[] {
    return this.relationshipsService.listMine();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.CREATE, 'Relationship')
  @ApiZodBody(RelationshipCreateSchema)
  @ApiZodResponse(201, RelationshipResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos (p. ej. sin consentimiento)')
  @ApiProblemResponse(409, 'SREL-E003 · Ya existe una relación activa con esa persona')
  @ApiProblemResponse(422, 'SREL-E001 · Contigo mismo · SREL-E002 · El alternante no existe')
  create(@Body() dto: CreateRelationshipDto): Promise<TRelationshipResponse> {
    return this.relationshipsService.create(dto);
  }

  @Patch(':uuid/grants')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Relationship')
  @ApiZodBody(RelationshipGrantsUpdateSchema)
  @ApiZodResponse(200, RelationshipResponseSchema)
  @ApiProblemResponse(403, 'SREL-E004 · Solo el titular cambia las reglas')
  @ApiProblemResponse(404, 'RREL-E001 · Relación no encontrada o no activa')
  updateGrants(
    @Param() { uuid }: UuidParamDto,
    @Body() dto: UpdateRelationshipGrantsDto,
  ): Promise<TRelationshipResponse> {
    return this.relationshipsService.updateGrants(uuid, dto);
  }

  /** Revoca: el historial se conserva (status REVOKED + endedAt). */
  @Delete(':uuid')
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.READ, 'Relationship')
  @ApiResponse({ status: 204, description: 'Relación revocada' })
  @ApiProblemResponse(403, 'SREL-E004 · Solo el titular revoca')
  @ApiProblemResponse(404, 'RREL-E001 · Relación no encontrada o no activa')
  revoke(@Param() { uuid }: UuidParamDto): Promise<void> {
    return this.relationshipsService.revoke(uuid);
  }
}
