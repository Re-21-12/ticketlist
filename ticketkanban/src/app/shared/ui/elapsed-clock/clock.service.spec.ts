import { TestBed } from '@angular/core/testing';
import { ClockService } from './clock.service';

describe('ClockService (un solo temporizador para todos los relojes)', () => {
  afterEach(() => vi.useRealTimers());

  it('avanza cada segundo mientras haya relojes y se detiene al irse el último', () => {
    vi.useFakeTimers();
    const clock = TestBed.inject(ClockService);
    const release = clock.subscribe();
    const releaseOther = clock.subscribe();
    const start = clock.$now();
    vi.advanceTimersByTime(3000);
    expect(clock.$now() - start).toBeGreaterThanOrEqual(3000);

    release();
    release(); // darse de baja dos veces no descuenta al otro reloj
    const mid = clock.$now();
    vi.advanceTimersByTime(2000);
    expect(clock.$now()).toBeGreaterThan(mid);

    releaseOther();
    const stopped = clock.$now();
    vi.advanceTimersByTime(5000);
    expect(clock.$now()).toBe(stopped);
  });
});
