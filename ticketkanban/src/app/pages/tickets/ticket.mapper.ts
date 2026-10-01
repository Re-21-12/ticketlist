import { TicketBaseSchema } from './ticket.schema';
import type { TTicket, TTicketUpsert } from './ticket.types';

const UPSERT_KEYS = Object.keys(TicketBaseSchema.shape) as (keyof TTicketUpsert)[];

/**
 * Un ticket leído (con `uuid`, `code`, `ownerUuid`, `createdAt`…) → el body de PATCH: SOLO los campos
 * editables del contrato (`TicketUpsertSchema`). Sirve para cambios parciales de UI, como mover una
 * tarjeta de columna: se reenvía el ticket completo con un campo distinto.
 */
export function toTicketUpsert(ticket: TTicket, changes: Partial<TTicketUpsert> = {}): TTicketUpsert {
  const merged = { ...ticket, ...changes } as Record<string, unknown>;
  return Object.fromEntries(
    UPSERT_KEYS.filter((key) => merged[key] !== undefined).map((key) => [key, merged[key]]),
  ) as TTicketUpsert;
}
