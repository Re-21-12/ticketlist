import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { EAbility, EUserRole } from '../auth/casl/ability.enum.js';
import { CheckAbility } from '../auth/casl/check-ability.decorator.js';
import { SessionIndexService } from '../auth/session/session-index.service.js';
import {
  AdminUserPageSchema,
  AdminUserQueryDto,
  AdminUserQuerySchema,
  AdminUserSchema,
  UpdateUserRoleDto,
  UpdateUserRoleSchema,
  UpdateUserStatusDto,
  UpdateUserStatusSchema,
} from './dtos/admin-user.dto.js';
import { UsersRepository, type IAdminUser } from './users.repository.js';

const UUID_PARAM = { name: 'uuid', schema: { type: 'string', format: 'uuid' } } as const;
const E403 = [403, 'SAUT-E001 · Solo administración gestiona usuarios'] as const;

const toResponse = (user: IAdminUser): z.output<typeof AdminUserSchema> =>
  AdminUserSchema.parse({ ...user, createdAt: user.createdAt.toISOString(), lockedAt: user.lockedAt?.toISOString() ?? null });

/**
 * Administración de usuarios (pantalla «Usuarios» de wallet-api). Los permisos salen de CASL
 * (`User`): por defecto solo ADMIN. Reglas de seguridad que NO dependen del rol configurado:
 * nadie cambia su PROPIO rol ni deshabilita su propia cuenta (evita bloquearse), y siempre queda
 * al menos un administrador activo.
 */
@ApiTags('Users · Administración')
@Controller('users')
export class UsersAdminController {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionIndex: SessionIndexService,
  ) {}

  @Get()
  @CheckAbility(EAbility.READ, 'User')
  @ApiZodQuery(AdminUserQuerySchema)
  @ApiZodResponse(200, AdminUserPageSchema)
  @ApiProblemResponse(...E403)
  list(@Query() query: AdminUserQueryDto): z.output<typeof AdminUserPageSchema> {
    const [rows, total] = this.usersRepository.listAdmin({
      page: query.page,
      take: query.take,
      ...(query.search ? { search: query.search } : {}),
      ...(query.role ? { role: query.role } : {}),
    });
    return { data: rows.map(toResponse), meta: { total, page: query.page, take: query.take } };
  }

  @Get(':uuid')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.READ, 'User')
  @ApiZodResponse(200, AdminUserSchema)
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'SUSR-E002 · Usuario no encontrado')
  findOne(@Param() { uuid }: UuidParamDto): z.output<typeof AdminUserSchema> {
    return toResponse(this.mustFind(uuid));
  }

  /** El rol rige desde la SIGUIENTE request del usuario (el actor se resuelve por sesión en cada una). */
  @Patch(':uuid/role')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.UPDATE, 'User')
  @ApiZodBody(UpdateUserRoleSchema)
  @ApiZodResponse(200, AdminUserSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Rol inválido')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'SUSR-E002 · Usuario no encontrado')
  @ApiProblemResponse(409, 'SUSR-E003 · Es tu propia cuenta / SUSR-E004 · Último administrador')
  changeRole(@Param() { uuid }: UuidParamDto, @Body() dto: UpdateUserRoleDto): z.output<typeof AdminUserSchema> {
    const target = this.mustFind(uuid);
    // Idempotente: si no cambia nada no hay nada que proteger (el formulario del front envía rol y estado juntos).
    if (target.role === dto.role) return toResponse(target);
    this.assertNotSelf(uuid);
    if (target.role === EUserRole.ADMIN && dto.role !== EUserRole.ADMIN) this.assertNotLastAdmin(target);
    return toResponse(this.usersRepository.setRole(uuid, dto.role) as IAdminUser);
  }

  /**
   * Deshabilitar cierra TODAS sus sesiones abiertas; habilitar no las restituye (debe iniciar sesión).
   * `locked: false` desbloquea una cuenta bloqueada por intentos fallidos (CU07, A3).
   */
  @Patch(':uuid/status')
  @ApiParam(UUID_PARAM)
  @CheckAbility(EAbility.UPDATE, 'User')
  @ApiZodBody(UpdateUserStatusSchema)
  @ApiZodResponse(200, AdminUserSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Datos inválidos')
  @ApiProblemResponse(...E403)
  @ApiProblemResponse(404, 'SUSR-E002 · Usuario no encontrado')
  @ApiProblemResponse(409, 'SUSR-E003 · Es tu propia cuenta / SUSR-E004 · Último administrador')
  async changeStatus(
    @Param() { uuid }: UuidParamDto,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ): Promise<z.output<typeof AdminUserSchema>> {
    let target = this.mustFind(uuid);
    // Desbloquear (solo administración): el usuario vuelve a poder iniciar sesión con sus 5 intentos nuevos.
    if (dto.locked === false && target.locked) target = this.usersRepository.unlock(uuid) as IAdminUser;
    if (target.disabled === dto.disabled) return toResponse(target);
    if (dto.disabled) {
      this.assertNotSelf(uuid);
      if (target.role === EUserRole.ADMIN) this.assertNotLastAdmin(target);
    }
    const updated = this.usersRepository.setDisabled(uuid, dto.disabled) as IAdminUser;
    if (dto.disabled) await this.sessionIndex.revokeOthers(uuid, '', req.sessionStore);
    return toResponse(updated);
  }

  private mustFind(uuid: string): IAdminUser {
    const user = this.usersRepository.findAdminByUuid(uuid);
    if (!user) throw new CustomBusinessException(ERROR_CODES.USR.NOT_FOUND);
    return user;
  }

  private assertNotSelf(uuid: string): void {
    if (RequestContext.currentUser()?.uuid === uuid) {
      throw new CustomBusinessException(ERROR_CODES.USR.CANNOT_CHANGE_SELF);
    }
  }

  /** Quitar el rol/habilitación a un ADMIN activo solo se permite si hay otro activo. */
  private assertNotLastAdmin(target: IAdminUser): void {
    if (!target.disabled && this.usersRepository.countActiveAdmins() <= 1) {
      throw new CustomBusinessException(ERROR_CODES.USR.LAST_ADMIN);
    }
  }
}
