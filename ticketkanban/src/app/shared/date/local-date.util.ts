/**
 * Fechas como DÍA, no como instante.
 *
 * El contrato (tickets y métricas) usa `YYYY-MM-DD` en hora local de quien mira, y el backend lo
 * interpreta en UTC con el extremo final inclusivo. La trampa clásica es `new Date('2026-10-03')`:
 * eso es medianoche **UTC**, que en UTC−6 es el 2 de octubre a las 18:00, y el filtro «Hoy» deja
 * fuera la mañana. Por eso los días se construyen siempre con `new Date(año, mes, día)`.
 */

/** `Date` → `YYYY-MM-DD` en hora local. */
export function toIsoDay(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * `YYYY-MM-DD` → `Date` de medianoche LOCAL; `''` o un texto inválido → `null`.
 *
 * Se valida con la vuelta (`toIsoDay` tiene que devolver el MISMO texto) porque `new Date(2026, 12, 40)`
 * no da `Invalid Date`: da el 9 de febrero de 2027. Sin esta comprobación, un `2026-02-30` se
 * convertiría en el 2 de marzo y el filtro «hasta el 30 de febrero» abarcaría un día de más.
 */
export function fromIsoDay(iso: string): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || toIsoDay(date) !== iso) return null;
  return date;
}

/** «3 oct» (con el año si no es el actual): corto para un botón, sin volverse ambiguo. */
export function formatDayShort(iso: string, now: Date = new Date()): string {
  const date = fromIsoDay(iso);
  if (!date) return iso;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}