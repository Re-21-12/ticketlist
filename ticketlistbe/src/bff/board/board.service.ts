import { Injectable } from '@nestjs/common';
import { TICKET_STATUS } from '../../modules/tickets/schemas/ticket.schema.js';
import { TicketsService } from '../../modules/tickets/tickets.service.js';
import { BoardResponseSchema, type TBoardResponse } from './dtos/board-response.dto.js';

const STATUS_LABELS: Record<(typeof TICKET_STATUS)[number], string> = {
  todo: 'Por hacer',
  in_progress: 'En progreso',
  done: 'Hecho',
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
      columns: TICKET_STATUS.map((status) => ({
        status,
        label: STATUS_LABELS[status],
        tickets: data.filter((ticket) => ticket.status === status),
      })),
    });
  }
}
