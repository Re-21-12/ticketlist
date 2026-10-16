import { TestBed } from '@angular/core/testing';
import { palette } from '@openng/optimus-ui-styled';
import { contrastRatio } from '../utils/color-contrast.util';
import { PrimaryColorService } from './primary-color.service';
import { DEFAULT_PRIMARY_HEX } from './theme.constants';
import { ThemePaletteService } from './theme-palette.service';
import { ThemeService } from './theme.service';

/**
 * La RAMPA TONAL que las barras y medidores usan (`--app-shade-*`, `--app-meter-*`).
 *
 * Los fallos que cubre esta prueba, los tres reales:
 *
 * 1. Las variables `--app-meter-*` se escribían con el NOMBRE del paso (`"400"`) en vez del color,
 *    así que el navegador descartaba el valor y las barras de antigüedad salían TRANSPARENTES.
 * 2. Se elegía «el primer paso accesible de una lista fija»: el tono suave de la rampa casi nunca
 *    llega a 3:1 sobre una superficie clara, así que las tres barras acababan del MISMO color. El
 *    requisito es que sean TONALIDADES DISTINTAS del color de marca elegido en `/appearance`.
 * 3. El contraste se medía contra un color de superficie SUPUESTO en vez del real, así que un
 *    cambio de tema podía dejar una barra por debajo de 3:1 sin que nadie se enterara.
 *
 * En jsdom `getComputedStyle` no resuelve `--app-surface`, así que las comprobaciones de contraste
 * corren contra el espejo declarado en el servicio (una superficie por modo).
 */
describe('ThemePaletteService (rampa tonal de los medidores)', () => {
  /** Espejo de `--app-surface`: blanco en claro, zinc-900 en oscuro. */
  const SURFACE = { light: '#ffffff', dark: '#18181b' } as const;
  /** WCAG 1.4.11: un objeto gráfico no textual necesita 3:1 contra su fondo. */
  const AA_NON_TEXT = 3;
  const HEX = /^#[0-9a-f]{3,8}$/i;
  const LEVELS = ['low', 'mid', 'high'] as const;
  const SHADES = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
  type TTones = Record<(typeof LEVELS)[number], string>;

  /** `TestBed` se configura una vez por prueba: volver a configurarlo lo reinicia y lanza. */
  let booted = false;

  function boot(hex: string, isDark: boolean): void {
    if (booted) return;
    booted = true;
    TestBed.configureTestingModule({ providers: [PrimaryColorService, ThemeService, ThemePaletteService] });
    TestBed.inject(PrimaryColorService).set(hex);
    TestBed.inject(ThemeService).set(isDark);
    TestBed.inject(ThemePaletteService);
    TestBed.flushEffects();
  }

  function setColor(hex: string): void {
    TestBed.inject(PrimaryColorService).set(hex);
    TestBed.flushEffects();
  }

  function setMode(isDark: boolean): void {
    TestBed.inject(ThemeService).set(isDark);
    TestBed.flushEffects();
  }

  /** Los tres tonos del medidor tal y como los lee el CSS en el modo activo. */
  function tones(): TTones {
    const style = document.documentElement.style;
    const mode = TestBed.inject(ThemeService).$isDark() ? 'dark' : 'light';
    const out = {} as TTones;
    for (const level of LEVELS) out[level] = style.getPropertyValue(`--app-meter-${level}-${mode}`).trim();
    return out;
  }

  /** La rampa completa publicada en `:root`. */
  function shades(): Record<string, string> {
    const style = document.documentElement.style;
    const out: Record<string, string> = {};
    for (const step of SHADES) out[step] = style.getPropertyValue(`--app-shade-${step}`).trim();
    return out;
  }

  /** Luminosidad perceptual (0–255) de un hex, para comparar tonalidades. */
  function lightness(hex: string): number {
    const value = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    return ((value >> 16) & 255) * 0.299 + ((value >> 8) & 255) * 0.587 + (value & 255) * 0.114;
  }

  afterEach(() => {
    booted = false;
    const style = document.documentElement.style;
    for (const step of SHADES) style.removeProperty(`--app-shade-${step}`);
    for (const mode of ['light', 'dark']) {
      for (const level of LEVELS) style.removeProperty(`--app-meter-${level}-${mode}`);
    }
    document.documentElement.classList.remove('app-dark');
    TestBed.resetTestingModule();
  });

  it('publica la rampa completa del color de marca como `--app-shade-<paso>`', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    const ramp = palette(DEFAULT_PRIMARY_HEX) as Record<string, string>;
    for (const step of SHADES) {
      expect(shades()[step], `paso ${step}`).toBe(ramp[step]);
    }
  });

  it('los medidores reciben COLORES, no nombres de paso (si no, la barra sale transparente)', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    for (const [name, value] of [
      ...Object.entries(shades()),
      ...Object.entries(tones()),
    ] as [string, string][]) {
      expect(value, name).toMatch(HEX);
    }
  });

  it('las tres lecturas son TONALIDADES DISTINTAS del color de marca, no el mismo color', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    expect(new Set(Object.values(tones())).size, 'claro').toBe(3);
    setMode(true);
    expect(new Set(Object.values(tones())).size, 'oscuro').toBe(3);
  });

  it('cada medidor contrasta 3:1 contra la superficie de SU modo (WCAG 1.4.11)', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    for (const [mode, isDark] of [
      ['light', false],
      ['dark', true],
    ] as const) {
      setMode(isDark);
      for (const level of LEVELS) {
        const color = tones()[level];
        expect(
          contrastRatio(color, SURFACE[mode]),
          `${level} en ${mode}: ${color} sobre ${SURFACE[mode]}`,
        ).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    }
  });

  it('la gravedad se lee por TONALIDAD: más oscuro en claro, más claro en oscuro', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    // Sobre superficie CLARA lo grave tiene que verse MÁS OSCURO (más lejos del fondo).
    const light = tones();
    expect(lightness(light.high), 'en claro lo intenso es el más oscuro').toBeLessThan(lightness(light.low));
    // Sobre superficie OSCURA se invierte: lo grave tiene que verse MÁS CLARO.
    setMode(true);
    const dark = tones();
    expect(lightness(dark.high), 'en oscuro lo intenso es el más claro').toBeGreaterThan(lightness(dark.low));
  });

  it('claro y oscuro publican TONOS distintos (la lectura se invierte con el fondo)', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    const light = Object.values(tones());
    setMode(true);
    const dark = Object.values(tones());
    expect(new Set([...light, ...dark]).size).toBe(6);
  });

  it('cambiar el color de marca repinta los medidores EN VIVO (sin recargar)', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    const before = tones().high;
    setColor('#1d4ed8'); // azul
    const after = tones().high;
    expect(after).toMatch(HEX);
    expect(after).not.toBe(before);
  });

  it('cambiar de modo vuelve a calcular los medidores contra la otra superficie', () => {
    boot(DEFAULT_PRIMARY_HEX, false);
    const inLight = tones().high;
    setMode(true);
    const inDark = tones().high;
    expect(inDark).toMatch(HEX);
    expect(inDark).not.toBe(inLight);
  });
});