import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BaseController } from '../../../core/base.controller.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../../core/dtos/uuid-param.dto.js';
import type { IPaginatedResult } from '../../../core/interfaces/Ipaginated-result.interface.js';
import { EAbility } from '../../auth/casl/ability.enum.js';
import { CheckAbility } from '../../auth/casl/check-ability.decorator.js';
import {
  CreateRolePermissionDto,
  RolePermissionPageSchema,
  RolePermissionQueryDto,
  RolePermissionQuerySchema,
  UpdateRolePermissionDto,
  type TRolePermissionResponse,
} from './dtos/role-permission.dtos.js';
import type { RolePermissionEntity } from './role-permission.entity.js';
import { RolePermissionsService } from './role-permissions.service.js';
import {
  RolePermissionCreateSchema,
  RolePermissionResponseSchema,
  RolePermissionUpdateSchema,
} from './schemas/role-permission.schema.js';

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
const E403 = [403, 'SAUT-E001 · Solo administración gestiona permisos'] as const;

/** CRUD de `role_permissions` (RBAC + ABAC por preset). Solo quien tenga el permiso (ADMIN). */
@ApiTags('Access control · Role permissions')
@Controller('role-permissions')
export class RolePermissionsController extends BaseController<
  RolePermissionEntity,
  TRolePermissionResponse,
  CreateRolePermissionDto,
  UpdateRolePermissionDto
> {
  constructor(protected override readonly service: RolePermissionsService) {
    super(service);
  }

  @Get()
  @CheckAbility(EAbility.READ, 'RolePermission')
  @ApiZodQuery(RolePermissionQuerySchema)
  @ApiZodResponse(200, RolePermissionPageSchema)
  @ApiProblemResponse(...E403)
  override findAll(@Query() query: RolePermissionQueryDto): Promise<IPaginatedResult<TRolePermissionResponse>> {
    const { role, subject, ...pagination } = query;
    return this.service.findAll(pagination, { ...(role ? { role } : {}), ...(subject ? { subject } : {}) });
  }

  @Get(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'RolePermission')
  @ApiZodResponse(200, RolePermissionResponseSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RRPM-E001 · Permiso no encontrado')
  override findOneByUuid(@Param() param: UuidParamDto): Promise<TRolePermissionResponse> {
    return super.findOneByUuid(param);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility(EAbility.CREATE, 'RolePermission')
  @ApiZodBody(RolePermissionCreateSchema)
  @ApiZodResponse(201, RolePermissionResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(409, 'RRPM-E002 · Ese rol ya tiene ese permiso')
  override create(@Body() dto: CreateRolePermissionDto): Promise<TRolePermissionResponse> {
    return super.create(dto);
  }

  @Patch(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.UPDATE, 'RolePermission')
  @ApiZodBody(RolePermissionUpdateSchema)
  @ApiZodResponse(200, RolePermissionResponseSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RRPM-E001 · Permiso no encontrado')
  @ApiProblemResponse(409, 'RRPM-E002 · Ese rol ya tiene ese permiso')
  @ApiProblemResponse(412, 'SCONC-E001 · `If-Match` no coincide')
  override update(@Param() param: UuidParamDto, @Body() dto: UpdateRolePermissionDto): Promise<TRolePermissionResponse> {
    return super.update(param, dto);
  }

  @Delete(':uuid')
  @ApiParam(UUID_PARAM)
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility(EAbility.DELETE, 'RolePermission')
  @ApiResponse({ status: 204, description: 'Permiso eliminado (borrado lógico)' })
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'RRPM-E001 · Permiso no encontrado')
  override softDeleteByUuid(@Param() param: UuidParamDto): Promise<void> {
    return super.softDeleteByUuid(param);
  }
}
