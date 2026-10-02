import * as z from 'zod';
import { RELATIONSHIP_STATUS } from '../sharing/relationship.schema';

/**
 * Relación vista por administración. Espejo de ticketlistbe/src/modules/relationships/dtos/relationship-admin.dto.ts.
 */
export const RelationshipAdminSchema = z.object({
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

/** Lo que muestra el modal de detalle (solo lectura: todo texto). */
export const RelationshipAdminViewSchema = z.object({
  titular: z.string(),
  alternante: z.string(),
  status: z.string(),
  grants: z.string(),
  consent: z.string(),
  createdAt: z.string(),
  endedAt: z.string(),
});
