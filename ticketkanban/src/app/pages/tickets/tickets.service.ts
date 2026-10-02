import { httpResource } from '@angular/common/http';
import { Service, signal } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { BaseApiAbstract } from '../../core/interfaces/base-api-abstract';
import { AssigneeListSchema, SurveyStateSchema, TicketBoardSchema, TicketSchema, toLocalIsoDate } from './ticket.schema';
import type { TSurveyForm, TSurveyState, TTicketTransition } from './ticket.types';
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

  /** Personal al que se le puede asignar un ticket (el backend filtra: verificado y ADMIN/AGENT). */
  readonly assignees = httpResource(() => '/api/users/assignable', {
    parse: (raw) => AssigneeListSchema.parse(raw),
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

  /** Cambia el estado (`POST /:uuid/transitions`): el único camino para mover un ticket de estado. */
  /** Estado de la encuesta del ticket (solo quien lo solicitó): `pending` se puede responder. */
  survey(uuid: string): Observable<TSurveyState> {
    return this._http.get<unknown>(`${this.endpoint}/${uuid}/survey`).pipe(map((raw) => SurveyStateSchema.parse(raw)));
  }

  answerSurvey(uuid: string, form: TSurveyForm): Observable<TSurveyState> {
    // El comentario vacío viaja como `null` (el contrato lo exige así).
    const body = { score: form.score, comment: form.comment || null };
    return this._http.post<unknown>(`${this.endpoint}/${uuid}/survey`, body).pipe(map((raw) => SurveyStateSchema.parse(raw)));
  }

  transition(uuid: string, dto: TTicketTransition): Observable<TTicket> {
    return this._http.post<unknown>(`${this.endpoint}/${uuid}/transitions`, dto).pipe(map((raw) => TicketSchema.parse(raw)));
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
