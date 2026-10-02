import type { z } from 'zod';
import type { MenuItemSchema, MenuItemUpsertSchema } from './menu-item.schema';

export type TMenuItem = z.output<typeof MenuItemSchema>;
export type TMenuItemUpsert = z.output<typeof MenuItemUpsertSchema>;
