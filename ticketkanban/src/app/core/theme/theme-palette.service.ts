import { DOCUMENT, effect, inject, Service } from '@angular/core';
import { palette } from '@openng/optimus-ui-styled';
import { contrastRatio } from '../utils/color-contrast.util';
import { PrimaryColorService } from './primary-color.service';
import { ThemeService } from './theme.service';
import { DEFAULT_PRIMARY_HEX } from './theme.constants';
import type { TPaletteStep, TPaletteSteps } from './theme.types';

/**
 * Contraste mínimo de una barra/medidor contra la superficie (WCAG 1.4.11, objetos gráficos no
 * textuales). No es el 4.5:1 del texto: la barra es una forma grande, pero tiene que distinguirse
 * del fondo en ambos modos.
 */
const WCAG_AA_NON_TEXT = 3;

/**
 * Pasos con los que se pinta un medidor. Se descartan los dos extremos (`50` y `950`): son los que
 * el tema usa para superficies y para texto, no para una barra; de este rango salen tres tonos
 * claramente distintos entre sí.
 */
const METER_RAMP: readonly TPaletteStep[] = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

interface ICandidate {
  readonly step: TPaletteStep;
  readonly color: string;
  readonly ratio: number;
}

/** Los tres tonos de un medidor para UNA superficie, ordenados de menos a más intenso. */
type TTones = readonly [bajo: string, medio: string, alto: string];

/**
 * Elige tres TONALIDADES del color de marca para un medidor: la menos intensa, la media y la más
 * intensa, todas con `WCAG_AA_NON_TEXT` de contraste contra la superficie.
 *
 * Por qué NO «el paso ideal, o el más cercano accesible»: el tono suave de la rampa (p. ej. el 400
 * de un verde) casi nunca llega a 3:1 sobre una superficie clara, así que se desplazaba al 600 y
 * las tres barras acababan pintadas del MISMO color. Aquí se parte de los tonos que SÍ contrastan y
 * se reparten tres distintos, de los extremos al centro.
 *
 * `dark` invierte la lectura: sobre fondo oscuro lo intenso tiene que verse MÁS claro.
 */
function pickTones(steps: TPaletteSteps, surface: string, dark: boolean): TTones {
  const all: ICandidate[] = METER_RAMP.filter((step) => steps[step]).map((step) => ({
    step,
    color: steps[step],
    ratio: contrastRatio(steps[step], surface),
  }));
  const accessible = all.filter((candidate) => candidate.ratio >= WCAG_AA_NON_TEXT);
  // Una rampa casi plana (un gris puro) puede no dar tres tonos accesibles: se toman los de mayor
  // contraste, que es lo mejor que hay. Es la excepción, no la norma.
  const pool =
    accessible.length >= 3 ? accessible : [...all].sort((a, b) => b.ratio - a.ratio).slice(0, 3);
  const ordered = [...pool].sort((a, b) => METER_RAMP.indexOf(a.step) - METER_RAMP.indexOf(b.step));
  const first = ordered[0];
  const middle = ordered[Math.round((ordered.length - 1) / 2)];
  const last = ordered[ordered.length - 1];
  return dark ? [last.color, middle.color, first.color] : [first.color, middle.color, last.color];
}

/**
 * Superficie contra la que se mide cuando el CSS no responde (jsdom no resuelve propiedades
 * personalizadas). Espejo de `--app-surface` en cada modo: blanco en claro, zinc-900 en oscuro.
 */
const SURFACE_FALLBACK = { light: '#ffffff', dark: '#18181b' } as const;
const HEX = /^#[0-9a-f]{3,8}$/i;

/**
 * Publica la RAMPA TONAL del color de marca como propiedades CSS `--app-shade-<paso>`.
 *
 * Por qué: las barras de antigüedad de «Métricas del equipo» (y cualquier medidor) necesitan
 * varias TONALIDADES del color elegido por el usuario, no colores sueltos. `PrimaryColorService`
 * ya calcula esa rampa para reescribir `--p-primary-*`, pero no la expone: este servicio la
 * escribe en `:root` para que el CSS la use con `var(--app-shade-700)`. Así, cambiar el color de
 * marca repinta también los medidores, sin tocar una línea de CSS.
 *
 * Los medidores se calculan contra la SUPERFICIE REAL (`--app-surface` ya resuelta por el modo, no
 * un color supuesto): por eso el efecto también depende de `ThemeService.$isDark()` y se vuelve a
 * pintar al cambiar de modo. `styles.css` reparte las variables por modo (`.app-dark` usa las
 * `-dark`) y deja un respaldo con `--app-shade-*` para el modo que no está activo.
 */
@Service()
export class ThemePaletteService {
  private readonly _document = inject(DOCUMENT);
  private readonly _primaryColor = inject(PrimaryColorService);
  private readonly _theme = inject(ThemeService);

  constructor() {
    // `effect` (no el constructor) para escribir solo cuando el color o el modo CAMBIAN: al arrancar,
    // el servicio no debe pisar los `--app-shade-*` por defecto de `styles.css` antes de tiempo.
    effect(() => this.apply(this._primaryColor.$customColor() ?? DEFAULT_PRIMARY_HEX, this._theme.$isDark()));
  }

  private apply(hex: string, dark: boolean): void {
    const steps = palette(hex) as unknown as TPaletteSteps;
    const root = this._document.documentElement;
    for (const [step, value] of Object.entries(steps) as [TPaletteStep, string][]) {
      root.style.setProperty(`--app-shade-${step}`, value);
    }
    // Las tres lecturas del medidor: TONALIDADES distintas del color de marca, cada una con contraste
    // MEDIDO contra la superficie donde se van a pintar (WCAG 1.4.11). En oscuro la lectura se
    // invierte: sobre fondo oscuro lo intenso tiene que verse MÁS claro.
    const declared = getComputedStyle(root).getPropertyValue('--app-surface').trim();
    const surface = HEX.test(declared) ? declared : SURFACE_FALLBACK[dark ? 'dark' : 'light'];
    const mode = dark ? 'dark' : 'light';
    const [low, mid, high] = pickTones(steps, surface, dark);
    root.style.setProperty(`--app-meter-low-${mode}`, low);
    root.style.setProperty(`--app-meter-mid-${mode}`, mid);
    root.style.setProperty(`--app-meter-high-${mode}`, high);
  }
}