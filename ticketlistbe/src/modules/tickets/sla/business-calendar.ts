/**
 * Calendario hábil para los plazos de SLA (docs/standard/metrics.md §3). Módulo PURO.
 *
 * Solo cuentan las horas laborales de los días laborales que no sean feriado. La zona horaria es un
 * DESFASE FIJO respecto a UTC (`utcOffsetMinutes`): suficiente mientras la operación esté en una zona sin
 * horario de verano (p. ej. Guatemala, UTC−6) y evita depender de la base de zonas del sistema.
 */
export interface IBusinessCalendar {
  /** Minutos de la hora local respecto a UTC (UTC−6 = −360). */
  readonly utcOffsetMinutes: number;
  /** Días laborales, 0 = domingo … 6 = sábado. */
  readonly workDays: readonly number[];
  /** Inicio y fin de la jornada, en minutos desde la medianoche local (8:00 = 480, 17:00 = 1020). */
  readonly startMinute: number;
  readonly endMinute: number;
  /** Feriados locales `YYYY-MM-DD`. */
  readonly holidays: readonly string[];
}

export const DEFAULT_CALENDAR: IBusinessCalendar = {
  utcOffsetMinutes: -360,
  workDays: [1, 2, 3, 4, 5],
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  holidays: [],
};

/** Intervalo en milisegundos UTC; `end: null` = abierto (p. ej. una pausa que sigue vigente). */
export interface IInterval {
  readonly start: number;
  readonly end: number | null;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
/** Tope de seguridad: nunca se itera más de ~10 años de calendario. */
const MAX_DAYS = 3660;

/** Medianoche LOCAL del día que contiene `ms`, expresada en ms UTC. */
function localMidnight(ms: number, calendar: IBusinessCalendar): number {
  const offset = calendar.utcOffsetMinutes * MINUTE;
  return Math.floor((ms + offset) / DAY) * DAY - offset;
}

function isWorkingDay(dayStartUtc: number, calendar: IBusinessCalendar): boolean {
  const local = new Date(dayStartUtc + calendar.utcOffsetMinutes * MINUTE);
  return calendar.workDays.includes(local.getUTCDay()) && !calendar.holidays.includes(local.toISOString().slice(0, 10));
}

/** Jornadas laborales (en ms UTC) que se solapan con `[from, to]`, en orden. */
function* workSegments(from: number, to: number, calendar: IBusinessCalendar): Generator<[number, number]> {
  let day = localMidnight(from, calendar);
  for (let i = 0; i < MAX_DAYS && day < to; i++, day += DAY) {
    if (!isWorkingDay(day, calendar)) continue;
    const start = Math.max(day + calendar.startMinute * MINUTE, from);
    const end = Math.min(day + calendar.endMinute * MINUTE, to);
    if (end > start) yield [start, end];
  }
}

/** Resta de `[start, end]` lo que cae dentro de las pausas; devuelve los trozos que quedan. */
function withoutPauses(start: number, end: number, pauses: readonly IInterval[]): [number, number][] {
  const sorted = pauses
    .map((pause) => ({ start: pause.start, end: pause.end ?? Number.POSITIVE_INFINITY }))
    .filter((pause) => pause.end > start && pause.start < end)
    .sort((a, b) => a.start - b.start);
  const pieces: [number, number][] = [];
  let cursor = start;
  for (const pause of sorted) {
    if (pause.start > cursor) pieces.push([cursor, Math.min(pause.start, end)]);
    cursor = Math.max(cursor, pause.end);
    if (cursor >= end) break;
  }
  if (cursor < end) pieces.push([cursor, end]);
  return pieces;
}

/** Minutos HÁBILES entre dos instantes, sin contar el tiempo en pausa. */
export function businessMinutesBetween(
  from: Date,
  to: Date,
  calendar: IBusinessCalendar = DEFAULT_CALENDAR,
  pauses: readonly IInterval[] = [],
): number {
  if (to <= from) return 0;
  let total = 0;
  for (const [start, end] of workSegments(from.getTime(), to.getTime(), calendar)) {
    for (const [pieceStart, pieceEnd] of withoutPauses(start, end, pauses)) total += pieceEnd - pieceStart;
  }
  return total / MINUTE;
}

/** Instante en que se cumplen `minutes` minutos hábiles desde `from` (sin contar las pausas). */
export function addBusinessMinutes(
  from: Date,
  minutes: number,
  calendar: IBusinessCalendar = DEFAULT_CALENDAR,
  pauses: readonly IInterval[] = [],
): Date {
  let remaining = minutes * MINUTE;
  if (remaining <= 0) return new Date(from);
  const horizon = from.getTime() + MAX_DAYS * DAY;
  for (const [start, end] of workSegments(from.getTime(), horizon, calendar)) {
    for (const [pieceStart, pieceEnd] of withoutPauses(start, end, pauses)) {
      const length = pieceEnd - pieceStart;
      if (length >= remaining) return new Date(pieceStart + remaining);
      remaining -= length;
    }
  }
  // Un calendario sin días laborales nunca cumple el plazo: falla fuerte en vez de colgar o inventar.
  throw new Error('El calendario hábil no tiene tiempo laborable suficiente para el plazo');
}
