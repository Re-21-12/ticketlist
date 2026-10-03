import {
  Body,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../core/base.controller.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { RequestContext } from '../../core/context/request-context.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import type { IPaginatedResult } from '../../core/interfaces/Ipaginated-result.interface.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { CreateTicketDto } from './dtos/create-ticket.dto.js';
import { TicketQueryDto, TicketQuerySchema } from './dtos/ticket-query.dto.js';
import { TicketPageSchema, type TTicketResponse } from './dtos/ticket-response.dto.js';
import { UpdateTicketDto } from './dtos/update-ticket.dto.js';
import { TicketCreateSchema, TicketResponseSchema, TicketUpsertSchema } from './schemas/ticket.schema.js';
import type { TicketEntity } from './ticket.entity.js';
import { TicketsService } from './tickets.service.js';

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;

/** Respuestas de error RFC 9457 documentadas (`<código> · <cuándo>`, ver docs/standard/error-catalog.md). */
const E400 = [400, 'CVAL-E001 · Datos inválidos (detalle por campo en `errors`)'] as const;
const E401 = [401, 'SAUT-E002 · Sin sesión · SAUT-E005 · Sesión expirada'] as const;
const E403 = [403, 'SAUT-E001 · Sin permiso · SAUT-E003 · Token CSRF inválido'] as const;
const E404 = [404, 'RTCK-E001 · Ticket no encontrado'] as const;
const E412 = [412, 'SCONC-E001 · `If-Match` no coincide: otra persona lo modificó'] as const;

/**
 * Capa de TRANSPORTE de `/api/tickets` — el recurso que consume `TicketsService` (extends
 * `BaseApiAbstract`) del front. Cada método declara su permiso (`@CheckAbility`, nivel TIPO) y su
 * contrato OpenAPI desde los MISMOS schemas Zod que validan.
 */
@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController extends BaseController<
  TicketEntity,
  TTicketResponse,
  CreateTicketDto,
  UpdateTicketDto
> {
  constructor(protected override readonly service: TicketsService) {
    super(service);
  }

  @Get()
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodQuery(TicketQuerySchema)
  @ApiZodResponse(200, TicketPageSchema)
  @ApiProblemResponse(...E400)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  override findAll(@Query() query: TicketQueryDto): Promise<IPaginatedResult<TTicketResponse>> {
    const { status, priority, type, category, department, mine, ...pagination } = query;
    const me = RequestContext.currentUser();
    return this.service.findAll(pagination, {
      ...(mine && me ? { ownerUuid: me.uuid } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(category ? { category } : {}),
      ...(department ? { department } : {}),
    });
  }

  @Head(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  override existsByUuid(@Param() param: UuidParamDto): Promise<void> {
    return super.existsByUuid(param);
  }

  @Get(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodResponse(200, TicketResponseSchema)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(410, 'RTCK-E002 · El ticket ya fue eliminado')
  override findOneByUuid(@Param() param: UuidParamDto): Promise<TTicketResponse> {
    return super.findOneByUuid(param);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.CREATE, 'Ticket')
  @ApiZodBody(TicketCreateSchema)
  @ApiZodResponse(201, TicketResponseSchema)
  @ApiProblemResponse(...E400)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  override create(@Body() dto: CreateTicketDto): Promise<TTicketResponse> {
    return super.create(dto);
  }

  /** Permiso por REGISTRO (condiciones, p. ej. asignado a mí) lo valida el servicio → 403 SAUT-E001. */
  @Patch(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiZodBody(TicketUpsertSchema)
  @ApiZodResponse(200, TicketResponseSchema)
  @ApiProblemResponse(...E400)
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(...E412)
  override update(@Param() param: UuidParamDto, @Body() dto: UpdateTicketDto): Promise<TTicketResponse> {
    return super.update(param, dto);
  }

  @Delete(':uuid')
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiResponse({ status: 204, description: 'Eliminado (borrado lógico)' })
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(...E412)
  override softDeleteByUuid(@Param() param: UuidParamDto): Promise<void> {
    return super.softDeleteByUuid(param);
  }

  @Patch(':uuid/restore')
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.READ, 'Ticket')
  @ApiResponse({ status: 204, description: 'Restaurado' })
  @ApiProblemResponse(...E401)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(409, 'RTCK-E003 · El ticket no está eliminado')
  override restoreByUuid(@Param() param: UuidParamDto): Promise<void> {
    return super.restoreByUuid(param);
  }
}
