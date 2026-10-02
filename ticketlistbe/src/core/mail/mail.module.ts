import { Global, Module } from '@nestjs/common';
import { LogMailService } from './log-mail.service.js';
import { MAIL_SERVICE } from './mail.service.js';

/** Servicio de correo global. Cambiar de adaptador es cambiar el `useClass` de este provider. */
@Global()
@Module({
  providers: [LogMailService, { provide: MAIL_SERVICE, useExisting: LogMailService }],
  exports: [MAIL_SERVICE, LogMailService],
})
export class MailModule {}
