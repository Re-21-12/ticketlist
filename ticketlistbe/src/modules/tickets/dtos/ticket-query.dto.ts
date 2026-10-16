import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';
import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { TicketFilterSchema } from '../schemas/ticket.schema.js';

/**
 * Query de `GET /api/tickets`: paginación estándar + filtros propios del recurso.
 *
 * El rango por fecha de registro se valida AQUÍ (y no en `TicketFilterSchema`) porque el refine
 * convierte el schema en `ZodEffects` y `TicketFilterSchema` se extiende con `.shape` para
 * reutilizarlo en otros lados.
 */
export const TicketQuerySchema = BasePaginationSchema.extend(TicketFilterSchema.shape)
  .refine((q) => !q.createdFrom || !q.createdTo || new Date(q.createdFrom) <= new Date(q.createdTo), {
    error: msg(V.TCK.DATE_RANGE_ORDER),
    path: ['createdTo'],
  })
  .refine((q) => !q.createdFrom || !q.createdTo || (new Date(q.createdTo).getTime() - new Date(q.createdFrom).getTime()) / 86_400_000 <= 366, {
    error: msg(V.TCK.DATE_RANGE_TOO_LONG, { max: 366 }),
    path: ['createdTo'],
  });

export class TicketQueryDto extends createZodDto(TicketQuerySchema) {}