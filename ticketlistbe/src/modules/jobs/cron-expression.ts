/**
 * Expresiones cron de 5 campos (minuto hora día-del-mes mes día-de-la-semana) para las tareas programadas. Sin
 * dependencias: soporta `*`, listas (`1,15`), rangos (`8-17`) y pasos (asterisco-barra-N, p. ej. cada 10 minutos, o `0-30/5`). Día de la semana 0–6 (0 = domingo;
 * 7 también es domingo). Si el día del mes Y el de la semana están restringidos, basta con que coincida UNO (como cron).
 */
export interface ICronExpression {
  readonly minutes: ReadonlySet<number>;
  readonly hours: ReadonlySet<number>;
  readonly days: ReadonlySet<number>;
  readonly months: ReadonlySet<number>;
  readonly weekdays: ReadonlySet<number>;
  readonly daysRestricted: boolean;
  readonly weekdaysRestricted: boolean;
}

const FIELDS: readonly { min: number; max: number }[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12 },
  { min: 0, max: 7 },
];

function parseField(raw: string, min: number, max: number): Set<number> | null {
  const values = new Set<number>();
  for (const part of raw.split(',')) {
    const [range, stepRaw, extra] = part.split('/');
    if (extra !== undefined || range === undefined || range === '') return null;
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) return null;
    let from: number;
    let to: number;
    if (range === '*') {
      from = min;
      to = max;
    } else if (range.includes('-')) {
      const [a, b, more] = range.split('-');
      if (more !== undefined || a === undefined || b === undefined || !/^\d+$/.test(a) || !/^\d+$/.test(b)) return null;
      from = Number(a);
      to = Number(b);
    } else {
      if (!/^\d+$/.test(range)) return null;
      from = Number(range);
      // `5/10` = desde 5 cada 10 hasta el máximo; sin paso es solo ese valor.
      to = stepRaw === undefined ? from : max;
    }
    if (from < min || to > max || from > to) return null;
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values.size > 0 ? values : null;
}

/** `null` si la expresión no es válida. */
export function parseCron(expression: string): ICronExpression | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const parsed = parts.map((part, i) => parseField(part, (FIELDS[i] as { min: number }).min, (FIELDS[i] as { max: number }).max));
  if (parsed.some((set) => set === null)) return null;
  const [minutes, hours, days, months, rawWeekdays] = parsed as Set<number>[];
  // 7 = domingo = 0
  const weekdays = new Set([...(rawWeekdays as Set<number>)].map((d) => d % 7));
  return {
    minutes: minutes as Set<number>,
    hours: hours as Set<number>,
    days: days as Set<number>,
    months: months as Set<number>,
    weekdays,
    daysRestricted: parts[2] !== '*',
    weekdaysRestricted: parts[4] !== '*',
  };
}

/** ¿La expresión coincide con este minuto? `offsetMinutes` = zona horaria en la que se interpreta (UTC−6 → −360). */
export function cronMatches(cron: ICronExpression, date: Date, offsetMinutes = 0): boolean {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  if (!cron.minutes.has(local.getUTCMinutes()) || !cron.hours.has(local.getUTCHours()) || !cron.months.has(local.getUTCMonth() + 1)) return false;
  const dayOk = cron.days.has(local.getUTCDate());
  const weekdayOk = cron.weekdays.has(local.getUTCDay());
  if (cron.daysRestricted && cron.weekdaysRestricted) return dayOk || weekdayOk;
  return dayOk && weekdayOk;
}
