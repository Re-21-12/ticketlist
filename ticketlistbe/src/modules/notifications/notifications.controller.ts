import { Controller, Get, Param, Patch, Sse } from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { NoHttpCache } from '../../core/decorators/no-http-cache.decorator.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { NotificationStreamService, type INotificationStreamMessage } from './notification-stream.service.js';
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
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly stream: NotificationStreamService,
  ) {}

  @Get()
  @ApiZodResponse(200, NotificationListSchema)
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  listMine(): z.output<typeof NotificationListSchema> {
    return this.notificationsService.listMine();
  }

  /**
   * Tiempo real (SSE, `text/event-stream`): un evento `notification` por cada notificación NUEVA de quien consulta y
   * un `ping` cada 25 s. `EventSource` reconecta solo; el cliente vuelve a pedir la lista al reconectar. Va ANTES de
   * `:uuid` para que `stream` no se tome por un uuid.
   */
  @Sse('stream')
  @NoHttpCache()
  @ApiProblemResponse(401, 'SAUT-E002 · Sin sesión')
  streamMine(): Observable<INotificationStreamMessage> {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return this.stream.streamFor(user.uuid);
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
