import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../common/codes/validation-errors.js';
import { createZodDto } from '../zod/create-zod-dto.js';

/** Espejo Zod de `BasePaginationDto` de wallet-api. Query params llegan como string → `coerce`. */
export const BasePaginationSchema = z.object({
  page: z.coerce.number().int().min(1, { error: msg(V.PAGINATION.MIN_PAGE, { min: 1 }) }).default(1),
  take: z.coerce.number().int().min(1).max(100, { error: msg(V.PAGINATION.MAX_TAKE, { max: 100 }) }).default(10),
  search: z.string().trim().max(100).optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sortBy: z.string().max(60).optional(),
  sortOrder: z.enum(['ASC', 'DESC']).optional(),
});

export class BasePaginationDto extends createZodDto(BasePaginationSchema) {}
