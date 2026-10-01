import { computedColorToHex } from './css-color.util';

describe('computedColorToHex', () => {
  it('convierte los formatos que devuelve getComputedStyle', () => {
    expect(computedColorToHex('rgb(16, 185, 129)')).toBe('#10b981');
    expect(computedColorToHex('rgba(255, 255, 255, 0.5)')).toBe('#ffffff');
    expect(computedColorToHex('color(srgb 1 0 0.5)')).toBe('#ff0080');
  });

  it('devuelve null si no reconoce el formato', () => {
    expect(computedColorToHex('oklch(0.7 0.1 150)')).toBeNull();
  });
});
