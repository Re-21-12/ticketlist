import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../core/base.controller.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import type { IPaginatedResult } from '../../core/interfaces/Ipaginated-result.interface.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import {
  CreateMenuItemDto,
  MenuItemPageSchema,
  MenuItemQueryDto,
  MenuItemQuerySchema,
  UpdateMenuItemDto,
  type TMenuItemResponse,
} from './dtos/menu-item.dtos.js';
import type { MenuItemEntity } from './menu-item.entity.js';
import { MenuItemsService } from './menu-items.service.js';
import {
  MenuItemCreateSchema,
  MenuItemResponseSchema,
  MenuItemUpdateSchema,
} from './schemas/menu-item.schema.js';

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
const E403 = [403, 'SAUT-E001 · Solo administración gestiona el menú'] as const;

/** CRUD de `menu_items`. El menú que ve cada persona lo arma `GET /api/bff/shell` con CASL. */
@ApiTags('Menú · Ítems')
@Controller('menu-items')
export class MenuItemsController extends BaseController<
  MenuItemEntity,
  TMenuItemResponse,
  CreateMenuItemDto,
  UpdateMenuItemDto
> {
  constructor(protected override readonly service: MenuItemsService) {
    super(service);
  }

  @Get()
  @CheckAbility(EAbility.READ, 'MenuItem')
  @ApiZodQuery(MenuItemQuerySchema)
  @ApiZodResponse(200, MenuItemPageSchema)
  @ApiProblemResponse(...E403)
  override findAll(@Query() query: MenuItemQueryDto): Promise<IPaginatedResult<TMenuItemResponse>> {
    const { group, ...pagination } = query;
    return this.service.findAll(pagination, group ? { group } : {});
  }

  @Get(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'MenuItem')
  @ApiZodResponse(200, MenuItemResponseSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RMNU-E001 · Ítem de menú no encontrado')
  @ApiProblemResponse(410, 'RMNU-E003 · El ítem ya fue eliminado')
  override findOneByUuid(@Param() param: UuidParamDto): Promise<TMenuItemResponse> {
    return super.findOneByUuid(param);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.CREATE, 'MenuItem')
  @ApiZodBody(MenuItemCreateSchema)
  @ApiZodResponse(201, MenuItemResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(409, 'RMNU-E002 · Ya existe esa clave')
  override create(@Body() dto: CreateMenuItemDto): Promise<TMenuItemResponse> {
    return super.create(dto);
  }

  @Patch(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.UPDATE, 'MenuItem')
  @ApiZodBody(MenuItemUpdateSchema)
  @ApiZodResponse(200, MenuItemResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RMNU-E001 · Ítem de menú no encontrado')
  @ApiProblemResponse(409, 'RMNU-E002 · Ya existe esa clave')
  @ApiProblemResponse(412, 'SCONC-E001 · `If-Match` no coincide')
  override update(@Param() param: UuidParamDto, @Body() dto: UpdateMenuItemDto): Promise<TMenuItemResponse> {
    return super.update(param, dto);
  }

  @Delete(':uuid')
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.DELETE, 'MenuItem')
  @ApiResponse({ status: 204, description: 'Ítem eliminado (borrado lógico)' })
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RMNU-E001 · Ítem de menú no encontrado')
  override softDeleteByUuid(@Param() param: UuidParamDto): Promise<void> {
    return super.softDeleteByUuid(param);
  }
}
