import { NO_DATA_TEXT } from './metrics.constants';

/** `Date` → `YYYY-MM-DD` en hora local. */
export function toIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Porcentaje con un decimal; `null` = sin información. */
export function formatPct(value: number | null): string {
  return value === null ? NO_DATA_TEXT : `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)} %`;
}

/** Minutos → «45 min», «2 h 30 min», «1 d 3 h»; `null` = sin información. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return NO_DATA_TEXT;
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const hoursLeft = hours % 24;
  return hoursLeft ? `${days} d ${hoursLeft} h` : `${days} d`;
}

/** Calificación 1–5 con dos decimales; `null` = sin información. */
export function formatScore(value: number | null): string {
  return value === null ? NO_DATA_TEXT : `${new Intl.NumberFormat('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value)} / 5`;
}
