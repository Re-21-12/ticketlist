import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type * as z from 'zod';
import { ApiProblemResponse, ApiZodResponse } from '../../core/decorators/api-zod.decorator.js';
import { UuidParamDto } from '../../core/dtos/uuid-param.dto.js';
import { NotificationsService } from './notifications.service.js';
import {
  NotificationListSchema,
  NotificationResponseSchema,
} from './schemas/notification.schema.js';

/** Autoservicio: cada quien ve y marca SOLO las suyas (el filtro es por destinatario en el servicio). */
@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiZodResponse(200, NotificationListSchema)
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  listMine(): z.output<typeof NotificationListSchema> {
    return this.notificationsService.listMine();
  }

  @Patch(':uuid/read')
  @ApiParam({ name: 'uuid', schema: { type: 'string', format: 'uuid' } })
  @ApiZodResponse(200, NotificationResponseSchema)
  @ApiProblemResponse(403, 'SAUT-E003 · Token CSRF inválido')
  @ApiProblemResponse(404, 'RNTF-E001 · Notificación no encontrada (o no es tuya)')
  markRead(@Param() { uuid }: UuidParamDto): Promise<z.output<typeof NotificationResponseSchema>> {
    return this.notificationsService.markRead(uuid);
  }
}
