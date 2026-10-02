import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import {
  CatalogCreateSchema,
  CatalogItemCreateSchema,
  CatalogItemParamSchema,
  CatalogItemUpdateSchema,
  CatalogKeyParamSchema,
  CatalogUpdateSchema,
} from '../schemas/catalog.schema.js';

export class CreateCatalogDto extends createZodDto(CatalogCreateSchema) {}
export class UpdateCatalogDto extends createZodDto(CatalogUpdateSchema) {}
export class CreateCatalogItemDto extends createZodDto(CatalogItemCreateSchema) {}
export class UpdateCatalogItemDto extends createZodDto(CatalogItemUpdateSchema) {}
export class CatalogKeyParamDto extends createZodDto(CatalogKeyParamSchema) {}
export class CatalogItemParamDto extends createZodDto(CatalogItemParamSchema) {}
