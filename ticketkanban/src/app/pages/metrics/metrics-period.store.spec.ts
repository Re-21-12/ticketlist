import { TestBed } from '@angular/core/testing';
import { MetricsPeriodStore, periodOfLastDays } from './metrics-period.store';

describe('MetricsPeriodStore', () => {
  let store: MetricsPeriodStore;

  beforeEach(() => {
    store = TestBed.inject(MetricsPeriodStore);
  });

  it('arranca en los últimos 30 días', () => {
    expect(store.$presetDays()).toBe(30);
    expect(store.$period()).toEqual(periodOfLastDays(30));
  });

  it('un preajuste cubre N días contando hoy', () => {
    const now = new Date(2026, 9, 10);
    expect(periodOfLastDays(7, now)).toEqual({ from: '2026-10-04', to: '2026-10-10' });
  });

  it('acepta un rango personalizado y deja de marcar el preajuste', () => {
    expect(store.setRange('2026-09-01', '2026-09-30')).toBe(true);
    expect(store.$period()).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(store.$presetDays()).toBeNull();
    expect(store.$error()).toBeNull();
  });

  it('rechaza un rango invertido, vacío o de más de 366 días y conserva el anterior', () => {
    const before = store.$period();
    expect(store.setRange('2026-10-10', '2026-10-01')).toBe(false);
    expect(store.$error()).toContain('inicial');
    expect(store.setRange('', '2026-10-01')).toBe(false);
    expect(store.setRange('2024-01-01', '2026-10-01')).toBe(false);
    expect(store.$error()).toContain('366');
    expect(store.$period()).toEqual(before);
  });
});
