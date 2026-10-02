import * as z from 'zod';
import { BasePaginationSchema } from '../../../core/dtos/base-pagination.dto.js';
import { paginatedSchema } from '../../../core/dtos/paginated-response.dto.js';
import { createZodDto } from '../../../core/zod/create-zod-dto.js';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '../audit-log.entity.js';

export const AuditLogResponseSchema = z.object({
  uuid: z.uuid(),
  at: z.iso.datetime(),
  action: z.enum(AUDIT_ACTIONS),
  subject: z.string(),
  route: z.string(),
  method: z.string(),
  resourceUuid: z.string().nullable(),
  status: z.number().int(),
  outcome: z.enum(AUDIT_OUTCOMES),
  actorUuid: z.string().nullable(),
  actorEmail: z.string().nullable(),
  actorRole: z.string().nullable(),
  ip: z.string(),
  userAgent: z.string(),
  requestId: z.string().nullable(),
  changedFields: z.array(z.string()),
});

export const AuditLogPageSchema = paginatedSchema(AuditLogResponseSchema);

/** Filtros: fechas ISO (`from`/`to`); solo lectura, no existe cuerpo de escritura. */
export const AuditLogQuerySchema = BasePaginationSchema.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  outcome: z.enum(AUDIT_OUTCOMES).optional(),
  subject: z.string().trim().max(60).optional(),
  actorUuid: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});
export class AuditLogQueryDto extends createZodDto(AuditLogQuerySchema) {}
