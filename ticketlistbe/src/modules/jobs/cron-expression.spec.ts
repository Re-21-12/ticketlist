import { cronMatches, parseCron } from './cron-expression.js';

const at = (iso: string) => new Date(iso);

describe('parseCron', () => {
  it('acepta las formas habituales', () => {
    for (const ok of ['* * * * *', '*/10 * * * *', '0 8-17 * * 1-5', '0,30 * * * *', '5/15 * * * *', '0 0 1 1 *', '0 9 * * 7']) {
      expect(parseCron(ok), ok).not.toBeNull();
    }
  });

  it('rechaza lo que no es una expresión válida', () => {
    for (const bad of ['', '* * * *', '* * * * * *', '60 * * * *', '* 24 * * *', '* * 0 * *', '* * * 13 *', '*/0 * * * *', 'a b c d e', '5-1 * * * *', '1-2-3 * * * *', '1//2 * * * *']) {
      expect(parseCron(bad), bad).toBeNull();
    }
  });
});

describe('cronMatches', () => {
  it('cada 10 minutos: coincide en 0, 10, 20…', () => {
    const cron = parseCron('*/10 * * * *')!;
    expect(cronMatches(cron, at('2026-10-05T12:00:00Z'))).toBe(true);
    expect(cronMatches(cron, at('2026-10-05T12:30:00Z'))).toBe(true);
    expect(cronMatches(cron, at('2026-10-05T12:07:00Z'))).toBe(false);
  });

  it('interpreta la hora en la zona indicada (UTC−6)', () => {
    const cron = parseCron('0 8 * * *')!;
    // 14:00 UTC = 08:00 en UTC−6
    expect(cronMatches(cron, at('2026-10-05T14:00:00Z'), -360)).toBe(true);
    expect(cronMatches(cron, at('2026-10-05T08:00:00Z'), -360)).toBe(false);
  });

  it('día de la semana: lunes a viernes (2026-10-05 es lunes; 2026-10-04, domingo)', () => {
    const cron = parseCron('0 9 * * 1-5')!;
    expect(cronMatches(cron, at('2026-10-05T09:00:00Z'))).toBe(true);
    expect(cronMatches(cron, at('2026-10-04T09:00:00Z'))).toBe(false);
    // 7 también es domingo
    expect(cronMatches(parseCron('0 9 * * 7')!, at('2026-10-04T09:00:00Z'))).toBe(true);
  });

  it('día del mes Y día de la semana restringidos: basta uno de los dos (como cron)', () => {
    const cron = parseCron('0 0 1 * 1')!; // el día 1 O cualquier lunes
    expect(cronMatches(cron, at('2026-10-01T00:00:00Z'))).toBe(true); // jueves 1
    expect(cronMatches(cron, at('2026-10-05T00:00:00Z'))).toBe(true); // lunes 5
    expect(cronMatches(cron, at('2026-10-06T00:00:00Z'))).toBe(false);
  });
});
