import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';

/** Transporte: `/api/notifications`. El servicio llega del `NotificationsModule` global. */
@Module({ controllers: [NotificationsController] })
export class NotificationsHttpModule {}
