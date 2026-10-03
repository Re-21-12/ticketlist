import { httpResource } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, type Observable } from 'rxjs';
import { MY_TICKETS_TAKE } from './my-tickets.constants';
import { MyTicketListSchema, TicketEventListSchema, TicketEventSchema } from './my-tickets.schema';
import type { TTicketEvent } from './my-tickets.types';

/** Acceso HTTP de «Mis tickets» (CU01): solo transporte + validación Zod. El estado de pantalla vive en `MyTicketsStore`. */
@Service()
export class MyTicketsService {
  private readonly _http = inject(HttpClient);
  /** Ticket cuyo historial se consulta; `undefined` deja ese resource en idle. */
  private readonly $_uuid = signal<string | undefined>(undefined);
  readonly $uuid = this.$_uuid.asReadonly();

  /** Los tickets que registró quien consulta, con su estado actual. */
  readonly list = httpResource(() => ({ url: '/api/tickets', params: { mine: 'true', take: String(MY_TICKETS_TAKE) } }), {
    parse: (raw) => MyTicketListSchema.parse(raw),
  });

  /** Historial de interacciones del ticket elegido. */
  readonly events = httpResource(
    () => {
      const uuid = this.$_uuid();
      return uuid ? `/api/tickets/${encodeURIComponent(uuid)}/events` : undefined;
    },
    { parse: (raw) => TicketEventListSchema.parse(raw) },
  );

  select(uuid: string | undefined): void {
    this.$_uuid.set(uuid);
  }

  comment(uuid: string, body: string): Observable<TTicketEvent> {
    return this._http
      .post<unknown>(`/api/tickets/${encodeURIComponent(uuid)}/comments`, { body, internal: false, attachmentIds: [] })
      .pipe(map((raw) => TicketEventSchema.parse(raw)));
  }

  reload(): void {
    this.list.reload();
    this.events.reload();
  }
}
