import type { z } from 'zod';
import type {
  CatalogCreateSchema,
  CatalogDetailSchema,
  CatalogItemSchema,
  CatalogItemUpsertSchema,
  CatalogSummarySchema,
  CatalogUpdateSchema,
} from './catalog.schema';

export type TCatalogSummary = z.output<typeof CatalogSummarySchema>;
export type TCatalogDetail = z.output<typeof CatalogDetailSchema>;
export type TCatalogItem = z.output<typeof CatalogItemSchema>;
export type TCatalogCreate = z.output<typeof CatalogCreateSchema>;
export type TCatalogUpdate = z.output<typeof CatalogUpdateSchema>;
export type TCatalogItemUpsert = z.output<typeof CatalogItemUpsertSchema>;
