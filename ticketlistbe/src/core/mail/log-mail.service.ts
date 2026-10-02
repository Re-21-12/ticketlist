import { Injectable, Logger } from '@nestjs/common';
import type { IMailMessage, IMailService } from './mail.service.js';

const OUTBOX_LIMIT = 50;

/**
 * Adaptador de desarrollo/tests: NO envía correo. Escribe el aviso en el log y guarda los últimos
 * mensajes en `outbox` (los tests leen de ahí). El destinatario se enmascara en el log (`a***@x.dev`)
 * para no filtrar correos a los archivos de log.
 */
@Injectable()
export class LogMailService implements IMailService {
  private readonly logger = new Logger('Mail');
  readonly outbox: IMailMessage[] = [];

  send(message: IMailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > OUTBOX_LIMIT) this.outbox.shift();
    this.logger.log(`[no se envía] «${message.subject}» → ${mask(message.to)} · ${message.link}`);
    return Promise.resolve();
  }
}

function mask(email: string): string {
  const [user, domain = ''] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
}
