import { TicketBaseSchema } from './ticket.schema';
import type { IFieldOption } from '../../shared/dynamic-form/field-config.interface';
import type { TAssignee, TTicket, TTicketUpsert } from './ticket.types';

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

/** Opción «vacía»: su valor `''` es el que el contrato (`assigneeEmail`) usa para «sin responsable». */
export const UNASSIGNED_OPTION: IFieldOption = { value: '', label: 'Sin asignar' };

/**
 * Opciones de «Asignado a»: «Sin asignar» + el personal disponible (`«Nombre» (correo)`), por nombre.
 * Si el ticket ya tiene a alguien que NO está en la lista (un correo antiguo, o alguien a quien le
 * bajaron el rol), se agrega para que el campo muestre lo guardado en vez de quedar en blanco y, al
 * guardar, no pierda al responsable en silencio.
 */
export function toAssigneeOptions(assignees: readonly TAssignee[], currentEmail?: string | null): IFieldOption[] {
  const options: IFieldOption[] = [
    UNASSIGNED_OPTION,
    ...assignees.map((person) => ({ value: person.email, label: `${person.name} (${person.email})` })),
  ];
  if (currentEmail && !assignees.some((person) => person.email === currentEmail)) {
    options.push({ value: currentEmail, label: `${currentEmail} (fuera de la lista)` });
  }
  return options;
}
