import { BaseEntity } from '../../core/base.entity.js';
import type { NOTIFICATION_TYPES } from './schemas/notification.schema.js';

export class NotificationEntity extends BaseEntity {
  recipientUuid!: string;
  type!: (typeof NOTIFICATION_TYPES)[number];
  message!: string;
  resourceType!: 'Ticket' | 'Relationship' | null;
  resourceUuid!: string | null;
  readAt!: Date | null;
}
