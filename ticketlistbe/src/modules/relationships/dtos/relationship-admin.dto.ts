import * as z from 'zod';
import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { paginatedSchema } from '../../../core/dtos/paginated-response.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { RELATIONSHIP_STATUS } from '../schemas/relationship.schema.js';

/** Una relación vista por administración: ambas personas con nombre y correo, y lo concedido. */
export const RelationshipAdminResponseSchema = z.object({
  uuid: z.uuid(),
  titularUuid: z.uuid(),
  titularName: z.string(),
  titularEmail: z.string(),
  alternanteUuid: z.uuid(),
  alternanteName: z.string(),
  alternanteEmail: z.string(),
  status: z.enum(RELATIONSHIP_STATUS),
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  notifyTitular: z.boolean(),
  consentVersion: z.string().nullable(),
  consentedAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const RelationshipAdminPageSchema = paginatedSchema(RelationshipAdminResponseSchema);

export const RelationshipAdminQuerySchema = BasePaginationSchema.extend({
  status: z.enum(RELATIONSHIP_STATUS).optional(),
});
export class RelationshipAdminQueryDto extends createZodDto(RelationshipAdminQuerySchema) {}
