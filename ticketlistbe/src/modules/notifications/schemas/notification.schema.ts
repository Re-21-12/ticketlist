import * as z from 'zod';

export const NOTIFICATION_TYPES = [
  /** Te asignaron un ticket (cambió `assigneeEmail` a tu correo). */
  'TICKET_ASSIGNED',
  /** Un alternante modificó un ticket tuyo y la concesión tiene `notifyTitular`. */
  'TICKET_CHANGED_BY_ALTERNANTE',
  /** Un titular te compartió sus tickets (nueva relación o concesión ampliada). */
  'RELATIONSHIP_GRANTED',
  /** Un titular revocó lo que te había compartido. */
  'RELATIONSHIP_REVOKED',
] as const;

export const NotificationResponseSchema = z.object({
  uuid: z.uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  message: z.string(),
  /** Recurso relacionado (para navegar), si aplica. */
  resourceType: z.enum(['Ticket', 'Relationship']).nullable(),
  resourceUuid: z.uuid().nullable(),
  readAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const NotificationListSchema = z.object({
  data: z.array(NotificationResponseSchema),
  unread: z.number().int(),
});
