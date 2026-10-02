import { formatElapsed } from './format-elapsed';

describe('formatElapsed (reloj de la tarjeta)', () => {
  it('h:mm:ss con minutos y segundos a dos dígitos', () => {
    expect(formatElapsed(0)).toBe('0:00:00');
    expect(formatElapsed(65_000)).toBe('0:01:05');
    expect(formatElapsed((2 * 3600 + 3 * 60 + 9) * 1000)).toBe('2:03:09');
  });

  it('pasado un día suma «d»', () => {
    expect(formatElapsed((26 * 3600 + 5) * 1000)).toBe('1 d 2:00:05');
  });

  it('un instante futuro (reloj desfasado) no da negativos', () => {
    expect(formatElapsed(-5000)).toBe('0:00:00');
  });
});
