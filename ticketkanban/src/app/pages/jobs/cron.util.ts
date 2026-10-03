/**
 * Expresiones cron de 5 campos (minuto hora día-del-mes mes día-de-la-semana), espejo de `cron-expression.ts` del backend:
 * valida lo que escribe el administrador al instante y calcula la próxima corrida en el mock. Soporta `*`, listas (`1,15`),
 * rangos (`8-17`) y pasos (cada N con barra, o `0-30/5`); día de la semana 0–6 (0 = domingo, 7 también). Si el día del mes y
 * el de la semana están restringidos, basta uno de los dos. El servidor es quien decide: esto solo adelanta el aviso.
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
  return {
    minutes: minutes as Set<number>,
    hours: hours as Set<number>,
    days: days as Set<number>,
    months: months as Set<number>,
    weekdays: new Set([...(rawWeekdays as Set<number>)].map((d) => d % 7)),
    daysRestricted: parts[2] !== '*',
    weekdaysRestricted: parts[4] !== '*',
  };
}

/** ¿Coincide con este minuto? `offsetMinutes` = zona horaria en la que se interpreta (UTC−6 → −360). */
export function cronMatches(cron: ICronExpression, date: Date, offsetMinutes = 0): boolean {
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  if (!cron.minutes.has(local.getUTCMinutes()) || !cron.hours.has(local.getUTCHours()) || !cron.months.has(local.getUTCMonth() + 1)) return false;
  const dayOk = cron.days.has(local.getUTCDate());
  const weekdayOk = cron.weekdays.has(local.getUTCDay());
  if (cron.daysRestricted && cron.weekdaysRestricted) return dayOk || weekdayOk;
  return dayOk && weekdayOk;
}

/** Próximo minuto (a partir del siguiente a `from`) en que coincide, hasta un año adelante; `null` si no hay. */
export function nextCronRun(expression: string, from: Date, offsetMinutes = 0): Date | null {
  const cron = parseCron(expression);
  if (!cron) return null;
  const start = Math.floor(from.getTime() / 60_000) + 1;
  for (let i = 0; i < 366 * 24 * 60; i++) {
    const candidate = new Date((start + i) * 60_000);
    if (cronMatches(cron, candidate, offsetMinutes)) return candidate;
  }
  return null;
}
