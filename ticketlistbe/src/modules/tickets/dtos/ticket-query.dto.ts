import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { TicketFilterSchema } from '../schemas/ticket.schema.js';

/** Query de `GET /api/tickets`: paginación estándar + filtros propios del recurso. */
export const TicketQuerySchema = BasePaginationSchema.extend(TicketFilterSchema.shape);

export class TicketQueryDto extends createZodDto(TicketQuerySchema) {}
