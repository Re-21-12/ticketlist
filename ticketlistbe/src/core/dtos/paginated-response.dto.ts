import * as z from 'zod';

/** Envelope `{ data, meta }` de `findAll` (espejo de `IPaginatedResult` del front). */
export function paginatedSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    data: z.array(item),
    meta: z.object({ total: z.number().int(), page: z.number().int(), take: z.number().int() }),
  });
}
