import { businessDayEnd, businessDayStart, isBareDate } from './business-day.util';

describe('día local del negocio (espejo del backend)', () => {
  it('un día va de las 00:00 a las 23:59:59.999 hora local (UTC−6), no del día UTC', () => {
    expect(businessDayStart('2026-10-28').toISOString()).toBe('2026-10-28T06:00:00.000Z');
    expect(businessDayEnd('2026-10-28').toISOString()).toBe('2026-10-29T05:59:59.999Z');
  });

  it('lo de las 23:03 locales (05:03Z del día siguiente) cae dentro de ese día', () => {
    const at = new Date('2026-10-29T05:03:00.000Z').getTime();
    expect(at).toBeGreaterThanOrEqual(businessDayStart('2026-10-28').getTime());
    expect(at).toBeLessThanOrEqual(businessDayEnd('2026-10-28').getTime());
  });

  it('isBareDate distingue una fecha sola de una con hora', () => {
    expect(isBareDate('2026-10-28')).toBe(true);
    expect(isBareDate('2026-10-28T10:00:00Z')).toBe(false);
  });
});
