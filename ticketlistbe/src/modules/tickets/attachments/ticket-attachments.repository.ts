import { TicketAttachmentSchema } from '../../../database/entity-schemas.js';
import { PersistenceService } from '../../../database/persistence.service.js';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ITicketAttachment } from './ticket-attachment.entity.js';

@Injectable()
export class TicketAttachmentsRepository implements OnModuleInit {
  private attachments: ITicketAttachment[] = [];

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    this.attachments = (await this.persistence.load(TicketAttachmentSchema)).map((row) => ({ ...row, content: row.content ? Buffer.from(row.content) : null }));
  }

  add(attachment: ITicketAttachment): void {
    this.attachments = [...this.attachments, attachment];
    this.persistence.save(TicketAttachmentSchema, attachment);
  }

  find(id: string, ticketUuid: string): ITicketAttachment | null {
    return this.attachments.find((a) => a.id === id && a.ticketUuid === ticketUuid) ?? null;
  }

  /** Adjuntos aún sin comentario que subió esta persona a este ticket. */
  findFree(ids: readonly string[], ticketUuid: string, uploadedBy: string): ITicketAttachment[] {
    return this.attachments.filter(
      (a) => ids.includes(a.id) && a.ticketUuid === ticketUuid && a.uploadedBy === uploadedBy && a.commentUuid === null,
    );
  }

  attachTo(ids: readonly string[], commentUuid: string): void {
    this.attachments = this.attachments.map((a) => (ids.includes(a.id) ? { ...a, commentUuid } : a));
    this.persistence.save(
      TicketAttachmentSchema,
      this.attachments.filter((a) => ids.includes(a.id)),
    );
  }
}
