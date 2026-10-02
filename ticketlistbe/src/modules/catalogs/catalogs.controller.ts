import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type * as z from 'zod';
import { ApiProblemResponse, ApiZodBody, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { EAbility } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { CatalogsService } from './catalogs.service.js';
import {
  CatalogItemParamDto,
  CatalogKeyParamDto,
  CreateCatalogDto,
  CreateCatalogItemDto,
  UpdateCatalogDto,
  UpdateCatalogItemDto,
} from './dtos/catalog.dtos.js';
import {
  CatalogCreateSchema,
  CatalogDetailSchema,
  CatalogItemCreateSchema,
  CatalogItemResponseSchema,
  CatalogItemUpdateSchema,
  CatalogListSchema,
  CatalogOptionsSchema,
  CatalogSummarySchema,
  CatalogUpdateSchema,
} from './schemas/catalog.schema.js';

const KEY_PARAM = { name: 'key', schema: { type: 'string', example: 'ticket-category' } } as const;
const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
const E403 = [403, 'SAUT-E001 · Solo administración gestiona catálogos'] as const;
const E404 = [404, 'RCAT-E001 · Catálogo no encontrado'] as const;

/** Catálogos (tablas dinámicas). Lectura de opciones: cualquier sesión; administración: `Catalog`. */
@ApiTags('Catálogos')
@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly service: CatalogsService) {}

  @Get()
  @CheckAbility(EAbility.READ, 'Catalog')
  @ApiZodResponse(200, CatalogListSchema)
  @ApiProblemResponse(...E403)
  list(): z.output<typeof CatalogListSchema> {
    return this.service.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.CREATE, 'Catalog')
  @ApiZodBody(CatalogCreateSchema)
  @ApiZodResponse(201, CatalogSummarySchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(409, 'RCAT-E005 · Ya existe un catálogo con esa clave')
  create(@Body() dto: CreateCatalogDto): z.output<typeof CatalogSummarySchema> {
    return this.service.create(dto);
  }

  /** Opciones activas para un formulario: no exige permiso de administración (solo sesión). */
  @Get(':key/options')
  @ApiParam(KEY_PARAM)
  @ApiZodResponse(200, CatalogOptionsSchema)
  @ApiProblemResponse(...E404)
  options(@Param() { key }: CatalogKeyParamDto): z.output<typeof CatalogOptionsSchema> {
    return this.service.options(key);
  }

  @Get(':key')
  @ApiParam(KEY_PARAM)
  @CheckAbility(EAbility.READ, 'Catalog')
  @ApiZodResponse(200, CatalogDetailSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  detail(@Param() { key }: CatalogKeyParamDto): z.output<typeof CatalogDetailSchema> {
    return this.service.detail(key);
  }

  @Patch(':key')
  @ApiParam(KEY_PARAM)
  @CheckAbility(EAbility.UPDATE, 'Catalog')
  @ApiZodBody(CatalogUpdateSchema)
  @ApiZodResponse(200, CatalogSummarySchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos (la clave no se puede cambiar)')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  update(@Param() { key }: CatalogKeyParamDto, @Body() dto: UpdateCatalogDto): z.output<typeof CatalogSummarySchema> {
    return this.service.update(key, dto);
  }

  @Delete(':key')
  @ApiParam(KEY_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.DELETE, 'Catalog')
  @ApiResponse({ status: 204, description: 'Catálogo eliminado con sus elementos' })
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(409, 'RCAT-E004 · Un catálogo de sistema no se elimina')
  remove(@Param() { key }: CatalogKeyParamDto): void {
    this.service.remove(key);
  }

  @Post(':key/items')
  @ApiParam(KEY_PARAM)
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.UPDATE, 'Catalog')
  @ApiZodBody(CatalogItemCreateSchema)
  @ApiZodResponse(201, CatalogItemResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(...E404)
  @ApiProblemResponse(409, 'RCAT-E003 · El código ya existe en este catálogo')
  createItem(
    @Param() { key }: CatalogKeyParamDto,
    @Body() dto: CreateCatalogItemDto,
  ): z.output<typeof CatalogItemResponseSchema> {
    return this.service.createItem(key, dto);
  }

  @Patch(':key/items/:uuid')
  @ApiParam(KEY_PARAM)
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.UPDATE, 'Catalog')
  @ApiZodBody(CatalogItemUpdateSchema)
  @ApiZodResponse(200, CatalogItemResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RCAT-E001 · Catálogo / RCAT-E002 · Elemento no encontrado')
  @ApiProblemResponse(409, 'RCAT-E003 · Código repetido / RCAT-E004 · Elemento de sistema')
  updateItem(
    @Param() { key, uuid }: CatalogItemParamDto,
    @Body() dto: UpdateCatalogItemDto,
  ): z.output<typeof CatalogItemResponseSchema> {
    return this.service.updateItem(key, uuid, dto);
  }

  @Delete(':key/items/:uuid')
  @ApiParam(KEY_PARAM)
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.UPDATE, 'Catalog')
  @ApiResponse({ status: 204, description: 'Elemento eliminado' })
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RCAT-E001 · Catálogo / RCAT-E002 · Elemento no encontrado')
  @ApiProblemResponse(409, 'RCAT-E004 · Un elemento de sistema no se elimina')
  removeItem(@Param() { key, uuid }: CatalogItemParamDto): void {
    this.service.removeItem(key, uuid);
  }
}
