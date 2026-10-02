import type * as z from 'zod';
import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { paginatedSchema } from '../../../core/dtos/paginated-response.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import {
  MenuItemCreateSchema,
  MenuItemFilterSchema,
  MenuItemResponseSchema,
  MenuItemUpdateSchema,
} from '../schemas/menu-item.schema.js';

export class CreateMenuItemDto extends createZodDto(MenuItemCreateSchema) {}
export class UpdateMenuItemDto extends createZodDto(MenuItemUpdateSchema) {}

export const MenuItemQuerySchema = BasePaginationSchema.extend(MenuItemFilterSchema.shape);
export class MenuItemQueryDto extends createZodDto(MenuItemQuerySchema) {}

export type TMenuItemResponse = z.output<typeof MenuItemResponseSchema>;
export const MenuItemPageSchema = paginatedSchema(MenuItemResponseSchema);
