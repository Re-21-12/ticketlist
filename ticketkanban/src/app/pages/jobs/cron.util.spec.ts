import { cronMatches, nextCronRun, parseCron } from './cron.util';

describe('cron.util (espejo del backend)', () => {
  it('acepta las expresiones válidas y rechaza las inválidas', () => {
    for (const ok of ['* * * * *', '*/10 * * * *', '0 8-17 * * 1-5', '0,30 * * * *', '5/15 * * * *', '0 9 * * 7']) expect(parseCron(ok), ok).not.toBeNull();
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', '* * 0 * *', '*/0 * * * *', 'cada rato', '5-1 * * * *']) expect(parseCron(bad), bad).toBeNull();
  });

  it('coincide en la zona indicada (UTC−6) y respeta días de la semana', () => {
    expect(cronMatches(parseCron('0 8 * * *')!, new Date('2026-10-05T14:00:00Z'), -360)).toBe(true);
    expect(cronMatches(parseCron('0 8 * * *')!, new Date('2026-10-05T08:00:00Z'), -360)).toBe(false);
    expect(cronMatches(parseCron('0 9 * * 1-5')!, new Date('2026-10-04T09:00:00Z'))).toBe(false); // domingo
  });

  it('calcula la próxima corrida', () => {
    expect(nextCronRun('*/10 * * * *', new Date('2026-10-05T12:03:20Z'))?.toISOString()).toBe('2026-10-05T12:10:00.000Z');
    expect(nextCronRun('0 2 * * *', new Date('2026-10-05T12:00:00Z'), -360)?.toISOString()).toBe('2026-10-06T08:00:00.000Z');
    expect(nextCronRun('cada rato', new Date())).toBeNull();
  });
});
