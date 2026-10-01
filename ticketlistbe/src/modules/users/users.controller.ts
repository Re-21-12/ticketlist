import { Body, Controller, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import {
  ApiProblemResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../../core/decorators/api-zod.decorator.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { UpdateAvatarDto, UpdateAvatarSchema } from './dtos/update-avatar.dto.js';
import { UsersRepository } from './users.repository.js';

const AvatarResponseSchema = UpdateAvatarSchema;

/** Perfil propio: hoy solo el avatar. Opera sobre el usuario de la sesión, nunca sobre un uuid recibido. */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersRepository: UsersRepository) {}

  @Patch('me/avatar')
  @ApiZodBody(UpdateAvatarSchema)
  @ApiZodResponse(200, AvatarResponseSchema)
  @ApiProblemResponse(400, 'CVAL-E001 · Ícono o color fuera de la lista')
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  updateAvatar(@Body() dto: UpdateAvatarDto): z.output<typeof AvatarResponseSchema> {
    const me = RequestContext.currentUser();
    const updated = me && this.usersRepository.updateAvatar(me.uuid, dto.avatarIcon, dto.avatarColor);
    if (!updated) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return { avatarIcon: updated.avatarIcon as z.output<typeof AvatarResponseSchema>['avatarIcon'], avatarColor: updated.avatarColor as z.output<typeof AvatarResponseSchema>['avatarColor'] };
  }
}
