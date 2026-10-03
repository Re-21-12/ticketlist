import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Service, signal } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { suppressErrorToast } from '../../core/interceptors/suppress-error-toast.token';
import { TicketSchema } from '../tickets/ticket.schema';
import type { TTicket } from '../tickets/ticket.types';
import { MY_TICKETS_TAKE } from './my-tickets.constants';
import { MyTicketListSchema, TicketEventListSchema, TicketEventSchema } from './my-tickets.schema';
import type { TTicketEvent } from './my-tickets.types';

/** Acceso HTTP de «Mis tickets» (CU01/CU02): solo transporte + validación Zod. El estado de pantalla vive en `MyTicketsStore`. */
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

  /** Comentario público con su evidencia (ids de adjuntos ya subidos). */
  comment(uuid: string, body: string, attachmentIds: readonly string[] = []): Observable<TTicketEvent> {
    return this._http
      .post<unknown>(`/api/tickets/${encodeURIComponent(uuid)}/comments`, { body, internal: false, attachmentIds })
      .pipe(map((raw) => TicketEventSchema.parse(raw)));
  }

  /** «Confirmar cierre» (`closed`) o «Reabrir ticket» (`reopened`, con un motivo opcional). */
  transition(uuid: string, to: 'closed' | 'reopened', note?: string): Observable<TTicket> {
    return this._http
      .post<unknown>(`/api/tickets/${encodeURIComponent(uuid)}/transitions`, { to, ...(note ? { note } : {}) })
      .pipe(map((raw) => TicketSchema.parse(raw)));
  }

  /**
   * Intento de editar un comentario previo (A1 de CU02): el backend SIEMPRE lo rechaza con 409 `STCK-E002` porque el
   * historial es inmutable. El error lo maneja quien llama (sin toast) para mostrarlo junto al comentario.
   */
  editComment(uuid: string, commentUuid: string, body: string): Observable<unknown> {
    return this._http.patch(`/api/tickets/${encodeURIComponent(uuid)}/comments/${encodeURIComponent(commentUuid)}`, { body }, { context: suppressErrorToast() });
  }

  reload(): void {
    this.list.reload();
    this.events.reload();
  }
}
