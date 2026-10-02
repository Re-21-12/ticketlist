import { PersistenceService } from '../../database/persistence.service.js';
import { NotificationSchema } from '../../database/entity-schemas.js';
import { NotificationEntity as NotificationRow } from './notification.entity.js';
import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/base.repository.js';
import type { NotificationEntity } from './notification.entity.js';

@Injectable()
export class NotificationsRepository extends InMemoryRepository<NotificationEntity> {
  protected readonly searchableFields: (keyof NotificationEntity)[] = ['message'];

  constructor(persistence: PersistenceService) {
    super([], { service: persistence, schema: NotificationSchema, create: () => new NotificationRow(), seed: 'empty' });
  }

  findForRecipient(recipientUuid: string, limit = 50): NotificationEntity[] {
    return this.rows
      .filter((n) => n.recipientUuid === recipientUuid && !n.isDeleted)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  countUnread(recipientUuid: string): number {
    return this.rows.filter((n) => n.recipientUuid === recipientUuid && !n.readAt && !n.isDeleted).length;
  }
}
