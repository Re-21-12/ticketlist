import { describe, expect, it } from 'vitest';
import { formatDayShort, fromIsoDay, toIsoDay } from './local-date.util';

/**
 * El motivo de que este util exista con su propio test: `new Date('2026-10-03')` es medianoche
 * **UTC**, que en UTC−6 es el 2 de octubre a las 18:00. Con esa conversión el filtro «Hoy» deja
 * fuera la mañana del día que la persona quiso ver. Los días se construyen siempre en hora local.
 */
describe('Días locales (`YYYY-MM-DD`)', () => {
  it('`toIsoDay` usa los componentes LOCALES, no los UTC', () => {
    // Una hora local que ya es el día siguiente en UTC (si el reloj está en UTC+2).
    expect(toIsoDay(new Date(2026, 9, 3, 1, 30))).toBe('2026-10-03');
    expect(toIsoDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('`fromIsoDay` devuelve medianoche local, no UTC', () => {
    const date = fromIsoDay('2026-10-03');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(3);
    expect(date?.getHours()).toBe(0);
    expect(fromIsoDay('2026-10-03')?.getTime()).toBe(new Date(2026, 9, 3).getTime());
  });

  it('`fromIsoDay` devuelve `null` en vez de una fecha inválida', () => {
    expect(fromIsoDay('')).toBeNull();
    expect(fromIsoDay('ayer')).toBeNull();
    // `new Date(2026, 12, 40)` no da `Invalid Date`: da el 9 de febrero de 2027. Sin la vuelta, un
    // «30 de febrero» se convertiría en el 2 de marzo y el filtro abarcaría un día de más.
    expect(fromIsoDay('2026-13-40')).toBeNull();
    expect(fromIsoDay('2026-02-30')).toBeNull();
    expect(fromIsoDay('2026-02-29')).toBeNull(); // 2026 no es bisiesto
    expect(fromIsoDay('2024-02-29')).not.toBeNull();
  });

  it('ida y vuelta sin cambiar de día', () => {
    expect(toIsoDay(fromIsoDay('2026-10-03')!)).toBe('2026-10-03');
  });

  it('`formatDayShort` es corto y solo pone el año cuando no es el actual', () => {
    const now = new Date(2026, 9, 3);
    expect(formatDayShort('2026-10-01', now)).toMatch(/1/);
    expect(formatDayShort('2026-10-01', now)).not.toMatch(/2026/);
    expect(formatDayShort('2025-10-01', now)).toMatch(/2025/);
  });

  it('`formatDayShort` devuelve el texto tal cual si no hay fecha', () => {
    expect(formatDayShort('ayer', new Date(2026, 9, 3))).toBe('ayer');
  });
});
