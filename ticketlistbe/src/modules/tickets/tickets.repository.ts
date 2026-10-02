import { PersistenceService } from '../../database/persistence.service.js';
import { TicketSchema } from '../../database/entity-schemas.js';
import { TicketEntity as TicketRow } from './ticket.entity.js';
import { Inject, Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/base.repository.js';
import type { TicketEntity } from './ticket.entity.js';
import { TICKETS_SEED, type ITicketsSeed } from './tickets.seed.js';

/** Capa de DATOS de tickets (en memoria). Solo lo propio del recurso: búsqueda y numeración. */
@Injectable()
export class TicketsRepository extends InMemoryRepository<TicketEntity> {
  protected readonly searchableFields: (keyof TicketEntity)[] = ['code', 'title', 'assigneeEmail'];

  constructor(@Inject(TICKETS_SEED) seed: ITicketsSeed, persistence: PersistenceService) {
    // Los tickets de demostración solo entran si la tabla está vacía; los reales nunca se pisan.
    super(seed.tickets, { service: persistence, schema: TicketSchema, create: () => new TicketRow(), seed: 'empty' });
  }

  nextCode(): string {
    return `TCK-${String(this.rows.length + 1).padStart(3, '0')}`;
  }

  /** Todos los vigentes (métricas y cierre automático), sin filtro de permisos. */
  findAllRows(): TicketEntity[] {
    return this.rows.filter((row) => !row.isDeleted);
  }
}
