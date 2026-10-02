import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../../common/codes/validation-errors.js';

export const RELATIONSHIP_STATUS = ['ACTIVE', 'REVOKED'] as const;
/** Recursos que un titular puede compartir (hoy solo tickets). */
export const SHAREABLE_OBJECT_TYPES = ['Ticket'] as const;
/** Versión del texto de consentimiento vigente: cada concesión guarda con cuál se otorgó. */
export const CURRENT_CONSENT_VERSION = '2026-09-29';

/** Lo que el titular concede a UN alternante sobre UN tipo de recurso: CRUD + notificar. */
export const GrantSchema = z.object({
  objectType: z.enum(SHAREABLE_OBJECT_TYPES, {
    error: msg(V.GENERIC.REQUIRED_SELECTION, { field: 'un recurso' }),
  }),
  canRead: z.boolean().default(true),
  canUpdate: z.boolean().default(false),
  /** Avisar al titular cuando el alternante cambie algo. */
  notifyTitular: z.boolean().default(true),
});

export const RelationshipCreateSchema = z.object({
  alternanteEmail: z.email({ error: msg(V.GENERIC.IS_EMAIL) }).transform((e) => e.toLowerCase()),
  grants: z.array(GrantSchema).min(1, { error: msg(V.RELATIONSHIP.GRANTS_REQUIRED) }),
  /** Consentimiento informado explícito (wallet-api §4): sin `true` no se crea la relación. */
  consent: z.literal(true, { error: msg(V.RELATIONSHIP.CONSENT_REQUIRED) }),
});

export const RelationshipGrantsUpdateSchema = z.object({
  grants: z.array(GrantSchema).min(1, { error: msg(V.RELATIONSHIP.GRANTS_REQUIRED) }),
  consent: z.literal(true, { error: msg(V.RELATIONSHIP.CONSENT_REQUIRED) }),
});

export const GrantResponseSchema = GrantSchema.extend({
  consentVersion: z.string(),
  consentedAt: z.iso.datetime(),
});

export const RelationshipResponseSchema = z.object({
  uuid: z.uuid(),
  titularUuid: z.uuid(),
  alternanteUuid: z.uuid(),
  alternanteEmail: z.email(),
  status: z.enum(RELATIONSHIP_STATUS),
  grants: z.array(GrantResponseSchema),
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  /** Desde el punto de vista de quien consulta. */
  myRole: z.enum(['TITULAR', 'ALTERNANTE']),
});
