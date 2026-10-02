import * as z from 'zod';
import { VALIDATION_ERRORS as V, validationMessage as msg } from '../../core/validation/validation-errors';

/**
 * CONTRATO de relaciones Titular → Alternante. Espejo de ticketlistbe/src/modules/relationships/schemas/relationship.schema.ts.
 * El titular comparte SUS tickets con otra persona (el alternante), con CRUD granular y consentimiento.
 */
export const RELATIONSHIP_STATUS = ['ACTIVE', 'REVOKED'] as const;

/** Lo que el titular concede sobre el recurso (hoy solo tickets): leer siempre va incluido y editar es opcional. Eliminar NUNCA se concede: es solo del administrador. */
export const GrantResponseSchema = z.object({
  objectType: z.literal('Ticket'),
  canRead: z.boolean(),
  canUpdate: z.boolean(),
  notifyTitular: z.boolean(),
  consentVersion: z.string(),
  consentedAt: z.iso.datetime(),
});

export const RelationshipSchema = z.object({
  uuid: z.uuid(),
  titularUuid: z.uuid(),
  alternanteUuid: z.uuid(),
  alternanteEmail: z.email(),
  status: z.enum(RELATIONSHIP_STATUS),
  grants: z.array(GrantResponseSchema),
  endedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  myRole: z.enum(['TITULAR', 'ALTERNANTE']),
});
export const RelationshipListSchema = z.array(RelationshipSchema);

const ConsentSchema = z.literal(true, { error: msg(V.RELATIONSHIP.CONSENT_REQUIRED) });

/** Formulario de «Compartir»: un solo recurso, así que los permisos son dos interruptores. */
export const GrantsFormSchema = z.object({
  canUpdate: z.boolean(),
  notifyTitular: z.boolean(),
  consent: ConsentSchema,
});

export const ShareFormSchema = z.object({
  alternanteEmail: z.email({ error: msg(V.GENERIC.IS_EMAIL) }),
  ...GrantsFormSchema.shape,
});
