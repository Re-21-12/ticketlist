import { formatMinutes, formatPct, formatScore, toIsoDay } from './metrics.format';

describe('metrics.format', () => {
  it('muestra «Sin información» cuando no hay valor (A1)', () => {
    expect(formatPct(null)).toBe('Sin información');
    expect(formatMinutes(null)).toBe('Sin información');
    expect(formatScore(null)).toBe('Sin información');
  });

  it('formatea minutos en la unidad que se lee mejor', () => {
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(150)).toBe('2 h 30 min');
    expect(formatMinutes(27 * 60)).toBe('1 d 3 h');
  });

  it('formatea porcentaje y calificación', () => {
    expect(formatPct(96.4)).toContain('96');
    expect(formatScore(4.5)).toContain('/ 5');
  });

  it('serializa el día en hora local', () => {
    expect(toIsoDay(new Date(2026, 9, 1))).toBe('2026-10-01');
  });
});
