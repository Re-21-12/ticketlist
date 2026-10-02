import { Injectable } from '@nestjs/common';
import { groupOf, STATUS_GROUP_KEYS, STATUS_GROUPS, type TStatusGroup } from '../../modules/tickets/lifecycle/ticket-lifecycle.js';
import { TicketsService } from '../../modules/tickets/tickets.service.js';
import { BoardResponseSchema, type TBoardResponse } from './dtos/board-response.dto.js';

/** Las tres columnas del tablero; el estado exacto de cada tarjeta es su insignia (catálogo `ticket-status`). */
const GROUP_LABELS: Record<TStatusGroup, string> = {
  new: 'Nuevo',
  in_attention: 'En atención',
  closed: 'Cerrado',
};

/** Máximo de tarjetas por tablero en el mock (sin paginación por columna todavía). */
const BOARD_LIMIT = 100;

/**
 * BFF del tablero: ORQUESTA el dominio (`TicketsService`, importado desde `TicketsModule` sin sus
 * rutas) y devuelve la forma de la pantalla. La lógica de negocio no se duplica aquí: el BFF
 * solo compone, agrupa y etiqueta.
 */
@Injectable()
export class BoardService {
  constructor(private readonly ticketsService: TicketsService) {}

  async getBoard(): Promise<TBoardResponse> {
    const { data } = await this.ticketsService.findAll({ page: 1, take: BOARD_LIMIT });
    return BoardResponseSchema.parse({
      columns: STATUS_GROUP_KEYS.map((group) => ({
        group,
        label: GROUP_LABELS[group],
        statuses: STATUS_GROUPS[group],
        tickets: data.filter((ticket) => groupOf(ticket.status) === group),
      })),
    });
  }
}
