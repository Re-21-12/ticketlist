/**
 * Rango por FECHA DE REGISTRO de `GET /api/tickets` (`?createdFrom=&createdTo=`), para el filtro de
 * fecha de la pantalla de tickets («Hoy» y un rango arbitrario).
 *
 * Por qué es una función aparte y no dos campos del schema: `TWhere` solo filtra por igualdad, así
 * que un rango necesita un predicado. Y hay un detalle que no es obvio: un `?createdTo=2026-10-03`
 * tiene que INCLUIR todo lo registrado ese día, así que el extremo final se lleva al último
 * milisegundo (`23:59:59.999`), no a las 00:00 como `new Date()` haría.
 *
 * Fechas sin hora (`2026-10-03`) son el DÍA LOCAL del calendario del negocio (UTC−6), igual que el período de métricas
 * (`localDayStart`/`localDayEnd`); con hora o desplazamiento se respeta el que trae el cliente.
 */
import { isBareDate, localDayEnd, localDayStart } from './sla/business-calendar.js';

/** Techo del rango, el mismo que en métricas (`MAX_PERIOD_DAYS`): evita filtrar por 40 años. */
export const MAX_DATE_RANGE_DAYS = 366;

/** Instante inicial del filtro (`YYYY-MM-DD` → 00:00 hora local; con hora → tal cual). */
export function rangeStart(from: string | undefined): Date | null {
  if (!from) return null;
  const date = isBareDate(from) ? localDayStart(from) : new Date(from);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Instante FINAL del filtro, INCLUSIVO: un `YYYY-MM-DD` sin hora se lleva al último milisegundo del
 * día para que «hoy» incluya lo que se registró hace un minuto.
 */
export function rangeEnd(to: string | undefined): Date | null {
  if (!to) return null;
  const end = isBareDate(to) ? localDayEnd(to) : new Date(to);
  return Number.isNaN(end.getTime()) ? null : end;
}

/**
 * Predicado para `BaseService.findAll`, o `undefined` si no hay rango (así el listado no filtra nada
 * por fecha y no se pierde rendimiento por una comparación por fila).
 */
export function createdAtRange(from: string | undefined, to: string | undefined): ((row: { createdAt: Date }) => boolean) | undefined {
  const start = rangeStart(from);
  const end = rangeEnd(to);
  if (!start && !end) return undefined;
  return (row) => {
    const at = row.createdAt.getTime();
    if (start && at < start.getTime()) return false;
    if (end && at > end.getTime()) return false;
    return true;
  };
}