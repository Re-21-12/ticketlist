import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type * as z from 'zod';
import { ERROR_CODES } from '../../common/codes/error-codes.js';
import { RequestContext } from '../../core/context/request-context.js';
import { CustomBusinessException } from '../../core/exceptions/app.exception.js';
import { NotificationEntity } from './notification.entity.js';
import { NotificationsRepository } from './notifications.repository.js';
import {
  NotificationResponseSchema,
  type NotificationListSchema,
} from './schemas/notification.schema.js';

type TNotificationResponse = z.output<typeof NotificationResponseSchema>;
type TNewNotification = Pick<
  NotificationEntity,
  'recipientUuid' | 'type' | 'message' | 'resourceType' | 'resourceUuid'
>;

/**
 * Notificaciones in-app. `notify()` lo llaman los servicios de dominio (tickets, relaciones) —
 * NUNCA decide por su cuenta a quién avisar: el destinatario sale de las mismas relaciones y
 * concesiones que usa la autorización (mismo principio que wallet-api: sin lógica paralela).
 * Solo el destinatario lee o marca sus notificaciones.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repository: NotificationsRepository) {}

  /** Nunca lanza: una falla al notificar no debe revertir la operación de negocio. */
  notify(notification: TNewNotification): void {
    const actor = RequestContext.currentUser()?.uuid ?? 'system';
    if (notification.recipientUuid === actor) return; // nadie se notifica a sí mismo
    const entity = Object.assign(new NotificationEntity(), notification, {
      uuid: randomUUID(),
      readAt: null,
      createdAt: new Date(),
      createdBy: actor,
      updatedAt: null,
      updatedBy: null,
      deletedAt: null,
      deletedBy: null,
      isDeleted: false,
      restoredAt: null,
      restoredBy: null,
    });
    this.repository
      .create(entity)
      .catch((error: unknown) => this.logger.error('No se pudo crear la notificación', error));
  }

  listMine(): z.output<typeof NotificationListSchema> {
    const me = this.me();
    return {
      data: this.repository.findForRecipient(me).map((n) => this.toResponse(n)),
      unread: this.repository.countUnread(me),
    };
  }

  async markRead(uuid: string): Promise<TNotificationResponse> {
    const notification = await this.repository.findByUuid(uuid, { recipientUuid: this.me() });
    if (!notification) throw new CustomBusinessException(ERROR_CODES.NTF.NOT_FOUND, { uuid });
    const updated = Object.assign(new NotificationEntity(), notification, {
      readAt: notification.readAt ?? new Date(),
      updatedAt: new Date(),
      updatedBy: this.me(),
    });
    await this.repository.update(updated);
    return this.toResponse(updated);
  }

  private me(): string {
    const user = RequestContext.currentUser();
    if (!user) throw new CustomBusinessException(ERROR_CODES.AUT.UNAUTHENTICATED);
    return user.uuid;
  }

  private toResponse(n: NotificationEntity): TNotificationResponse {
    return NotificationResponseSchema.parse({
      uuid: n.uuid,
      type: n.type,
      message: n.message,
      resourceType: n.resourceType,
      resourceUuid: n.resourceUuid,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    });
  }
}
