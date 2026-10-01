import { describeUserAgent } from './session-display.util';

describe('describeUserAgent', () => {
  it('Chrome en Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    expect(describeUserAgent(ua)).toEqual({ label: 'Chrome en Windows', icon: 'pi pi-desktop' });
  });

  it('Edge no se confunde con Chrome (también dice «Chrome»)', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Safari/537.36 Edg/126.0';
    expect(describeUserAgent(ua).label).toBe('Edge en Windows');
  });

  it('un móvil lleva ícono de móvil', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
    expect(describeUserAgent(ua)).toEqual({ label: 'Safari en iOS', icon: 'pi pi-mobile' });
  });

  it('sin User-Agent no inventa nada', () => {
    expect(describeUserAgent('').label).toBe('Dispositivo desconocido');
  });
});
