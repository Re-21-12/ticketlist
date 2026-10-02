import { TicketEventSchema } from '../../../database/entity-schemas.js';
import { PersistenceService } from '../../../database/persistence.service.js';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { TICKETS_SEED, type ITicketsSeed } from '../tickets.seed.js';
import type { ITicketEvent } from './ticket-event.entity.js';

/** Historial de tickets EN MEMORIA, solo de añadir: no existe update ni delete. */
@Injectable()
export class TicketEventsRepository implements OnModuleInit {
  private events: ITicketEvent[];

  constructor(
    @Inject(TICKETS_SEED) seed: ITicketsSeed,
    private readonly persistence: PersistenceService,
  ) {
    this.events = [...seed.events];
  }

  /** Con Postgres: el historial guardado es el que vale; las semillas (demostración) solo entran si la tabla está vacía. */
  async onModuleInit(): Promise<void> {
    if (!this.persistence.enabled) return;
    const stored = (await this.persistence.load(TicketEventSchema)).map((row) => ({
      ...row,
      // `jsonb` y las columnas opcionales: `null` en la base = ausente en el modelo.
      to: row.to ?? undefined,
      by: row.by ?? undefined,
      status: row.status ?? undefined,
    })) as ITicketEvent[];
    if (stored.length === 0 && this.events.length > 0) this.persistence.save(TicketEventSchema, this.events);
    else this.events = stored;
  }

  append(event: ITicketEvent): void {
    this.events = [...this.events, event];
    this.persistence.save(TicketEventSchema, event);
  }

  /** Cronológico (el más viejo primero). */
  listByTicket(ticketUuid: string): ITicketEvent[] {
    return this.events.filter((e) => e.ticketUuid === ticketUuid).sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  listAll(): ITicketEvent[] {
    return [...this.events];
  }
}
