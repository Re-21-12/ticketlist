import { Global, Module } from '@nestjs/common';
import { NotificationStreamService } from './notification-stream.service.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';

/** Dominio global: cualquier módulo de negocio puede `notify()` sin importar este módulo. */
@Global()
@Module({
  providers: [NotificationsRepository, NotificationStreamService, NotificationsService],
  exports: [NotificationsService, NotificationStreamService],
})
export class NotificationsModule {}
