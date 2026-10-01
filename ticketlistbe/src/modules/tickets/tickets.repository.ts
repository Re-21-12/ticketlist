import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/base.repository.js';
import type { TicketEntity } from './ticket.entity.js';
import { TICKETS_SEED } from './tickets.seed.js';

/** Capa de DATOS de tickets (en memoria). Solo lo propio del recurso: búsqueda y numeración. */
@Injectable()
export class TicketsRepository extends InMemoryRepository<TicketEntity> {
  protected readonly searchableFields: (keyof TicketEntity)[] = ['code', 'title', 'assigneeEmail'];

  constructor() {
    super(TICKETS_SEED);
  }

  nextCode(): string {
    return `TCK-${String(this.rows.length + 1).padStart(3, '0')}`;
  }
}
