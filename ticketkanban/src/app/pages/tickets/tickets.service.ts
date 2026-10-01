import { httpResource } from '@angular/common/http';
import { Service, signal } from '@angular/core';
import type { Observable } from 'rxjs';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { TicketBoardSchema, TicketSchema, toLocalIsoDate } from './ticket.schema';
import type { TTicket, TTicketQuickCreate, TTicketUpsert } from './ticket.types';

type TTicketRequest = TTicketUpsert | TTicketQuickCreate;

/**
 * Acceso HTTP de la página de tickets: SOLO transporte + validación Zod de la respuesta. El
 * estado de pantalla (guardando, qué se muestra) vive en `TicketsStore`.
 *
 * - CRUD del recurso `/api/tickets` → heredado de `BaseApiAbstract` (mismo contrato que
 *   `IBaseController` del backend).
 * - `board` → endpoint BFF `/api/bff/board`: la pantalla recibe las columnas ya armadas.
 */
@Service()
export class TicketsService extends BaseApiAbstract<TTicket, TTicketRequest, TTicketUpsert> {
  protected readonly endpoint = '/api/tickets';
  protected readonly $uuid = signal<string | undefined>(undefined);

  readonly board = httpResource(() => '/api/bff/board', {
    parse: (raw) => TicketBoardSchema.parse(raw),
  });

  protected override parseItem(raw: unknown): TTicket {
    return TicketSchema.parse(raw);
  }

  override create(dto: TTicketRequest): Observable<TTicket> {
    return super.create(toRequest(dto) as TTicketRequest);
  }

  override update(uuid: string, dto: TTicketUpsert): Observable<TTicket> {
    return super.update(uuid, toRequest(dto) as TTicketUpsert);
  }

  selectTicket(uuid: string | undefined): void {
    this.$uuid.set(uuid);
  }

  /** Recarga tablero + listado + ítem (lo usa el store tras una mutación exitosa). */
  override reload(): void {
    super.reload();
    this.board.reload();
  }
}

/** `Date` → 'YYYY-MM-DD' local antes de serializar (ver `toLocalIsoDate`). */
function toRequest(dto: TTicketRequest): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dto).map(([key, value]) => [
      key,
      value instanceof Date ? toLocalIsoDate(value) : value,
    ]),
  );
}
