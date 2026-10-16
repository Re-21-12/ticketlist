import { describe, expect, it } from 'vitest';
import { createdAtRange, rangeEnd, rangeStart } from './ticket-date-range.js';

/**
 * El detalle que este filtro tiene que cumplir y que `new Date()` no da solo: un `?createdTo=` de
 * SOLO FECHA incluye todo lo registrado ese día («Hoy» tiene que salir vacío con un ticket creado
 * hace un minuto, no con uno de ayer).
 */
describe('Rango por fecha de registro de tickets', () => {
  const row = (iso: string) => ({ createdAt: new Date(iso) });
  const keeps = (from?: string, to?: string) => {
    const predicate = createdAtRange(from, to);
    if (!predicate) return null;
    return (iso: string) => predicate(row(iso));
  };

  it('sin rango NO filtra (y devuelve el predicado para no comparar fila por fila sin motivo)', () => {
    expect(createdAtRange(undefined, undefined)).toBeUndefined();
    expect(createdAtRange('', '')).toBeUndefined();
  });

  it('`createdFrom` a secas arranca a la medianoche UTC de ese día', () => {
    expect(rangeStart('2026-10-03')?.toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });

  it('`createdTo` a secas se lleva al ÚLTIMO milisegundo del día, para que «hoy» incluya el día entero', () => {
    expect(rangeEnd('2026-10-03')?.toISOString()).toBe('2026-10-03T23:59:59.999Z');
    // Con hora explícita se respeta tal cual: el cliente sabe lo que pidió.
    expect(rangeEnd('2026-10-03T10:30:00.000Z')?.toISOString()).toBe('2026-10-03T10:30:00.000Z');
  });

  it('«hoy» incluye todo lo creado desde la medianoche hasta el último instante del día', () => {
    const isToday = keeps('2026-10-03', '2026-10-03');
    expect(isToday).not.toBeNull();
    expect(isToday?.('2026-10-03T00:00:00.000Z')).toBe(true);
    expect(isToday?.('2026-10-03T23:59:59.999Z')).toBe(true);
    expect(isToday?.('2026-10-03T12:34:56.000Z')).toBe(true);
    // Un segundo antes de la medianoche ya es de ayer.
    expect(isToday?.('2026-10-02T23:59:59.999Z')).toBe(false);
    // Y un segundo después del cierre del día, de mañana.
    expect(isToday?.('2026-10-04T00:00:00.000Z')).toBe(false);
  });

  it('rango de varios días: los extremos van dentro, los de afuera no', () => {
    const isInRange = keeps('2026-10-01', '2026-10-03');
    expect(isInRange?.('2026-09-30T23:59:59.999Z')).toBe(false);
    expect(isInRange?.('2026-10-01T00:00:00.000Z')).toBe(true);
    expect(isInRange?.('2026-10-03T23:59:59.999Z')).toBe(true);
    expect(isInRange?.('2026-10-04T00:00:00.000Z')).toBe(false);
  });

  it('un solo extremo abierto: desde el día hasta el final, o desde el inicio hasta el día', () => {
    const since = keeps('2026-10-03');
    expect(since?.('2026-10-02T12:00:00.000Z')).toBe(false);
    expect(since?.('2026-12-31T12:00:00.000Z')).toBe(true);

    const until = keeps(undefined, '2026-10-03');
    expect(until?.('2026-01-01T12:00:00.000Z')).toBe(true);
    expect(until?.('2026-10-04T00:00:00.000Z')).toBe(false);
  });
});