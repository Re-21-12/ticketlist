import * as z from 'zod';

export const AUDIT_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SIGN_IN', 'SIGN_OUT'] as const;
export const AUDIT_OUTCOMES = ['SUCCESS', 'DENIED', 'FAILED'] as const;

/** Entrada de auditoría (solo lectura). Espejo de ticketlistbe/src/modules/audit-log/dtos/audit-log.dto.ts. */
export const AuditLogSchema = z.object({
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

/** Lo que muestra el modal de detalle (todo texto: es solo lectura). */
export const AuditLogViewSchema = z.object({
  at: z.string(),
  actorEmail: z.string(),
  actorRole: z.string(),
  action: z.string(),
  outcome: z.string(),
  status: z.string(),
  method: z.string(),
  route: z.string(),
  resourceUuid: z.string(),
  changedFields: z.string(),
  ip: z.string(),
  requestId: z.string(),
  userAgent: z.string(),
});
