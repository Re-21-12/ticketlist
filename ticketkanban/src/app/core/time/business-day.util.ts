/**
 * Desfase de la zona del negocio respecto a UTC (UTC−6, Guatemala). Espejo de `DEFAULT_CALENDAR.utcOffsetMinutes`
 * (`ticketlistbe/src/modules/tickets/sla/business-calendar.ts`): el servidor y la pantalla tienen que leer un día sin hora igual.
 */
export const BUSINESS_UTC_OFFSET_MINUTES = -360;

const DAY_MS = 24 * 60 * 60_000;
const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `true` si el texto es solo una fecha (`YYYY-MM-DD`), sin hora ni desplazamiento. */
export const isBareDate = (value: string): boolean => BARE_DATE.test(value);

/** Primer instante (00:00 hora local del negocio) del día `YYYY-MM-DD`, como instante UTC. `2026-10-28` → `2026-10-28T06:00Z`. */
export function businessDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) - BUSINESS_UTC_OFFSET_MINUTES * 60_000);
}

/** Último milisegundo (23:59:59.999 hora local) del día `YYYY-MM-DD`: el extremo inclusivo de un rango que termina ese día. */
export function businessDayEnd(day: string): Date {
  return new Date(businessDayStart(day).getTime() + DAY_MS - 1);
}
