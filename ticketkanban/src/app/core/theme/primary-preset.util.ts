import { palette } from '@openng/optimus-ui-styled';
import { definePreset } from '@openng/optimus-ui-themes';
import Aura from '@openng/optimus-ui-themes/aura';
import { contrastRatio, WCAG_AA_NORMAL_TEXT } from '../utils/color-contrast.util';
import { DEFAULT_PRIMARY_HEX, PRIMARY_COLOR_STORAGE_KEY } from './theme.constants';
import type { TPaletteStep, TPaletteSteps } from './theme.types';

const STEP_ORDER: readonly TPaletteStep[] = [
  '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950',
];
/** Orden de preferencia por modo: se parte del paso "natural" y se aleja solo si no pasa AA. */
const LIGHT_STEP_PREFERENCE: readonly TPaletteStep[] = [
  '600', '700', '800', '500', '900', '950', '400', '300', '200', '100', '50',
];
const DARK_STEP_PREFERENCE: readonly TPaletteStep[] = [
  '400', '300', '500', '200', '100', '600', '50', '700', '800', '900', '950',
];

interface IAccessibleStep {
  step: TPaletteStep;
  hex: string;
  textColor: '#ffffff' | '#000000';
}

function stepAtOffset(step: TPaletteStep, offset: number): TPaletteStep {
  const index = STEP_ORDER.indexOf(step);
  return STEP_ORDER[Math.min(STEP_ORDER.length - 1, Math.max(0, index + offset))];
}

/** Primer paso (en el orden preferido) que pasa AA contra blanco o negro; en claro se prefiere blanco. */
function pickAccessibleStep(
  steps: TPaletteSteps,
  preference: readonly TPaletteStep[],
  preferWhiteText: boolean,
): IAccessibleStep {
  if (preferWhiteText) {
    const withWhite = preference.find((s) => contrastRatio(steps[s], '#ffffff') >= WCAG_AA_NORMAL_TEXT);
    if (withWhite) return { step: withWhite, hex: steps[withWhite], textColor: '#ffffff' };
  }
  let best: (IAccessibleStep & { ratio: number }) | null = null;
  for (const step of preference) {
    const white = contrastRatio(steps[step], '#ffffff');
    const black = contrastRatio(steps[step], '#000000');
    const candidate = {
      step,
      hex: steps[step],
      textColor: white >= black ? ('#ffffff' as const) : ('#000000' as const),
      ratio: Math.max(white, black),
    };
    if (candidate.ratio >= WCAG_AA_NORMAL_TEXT) return candidate;
    if (!best || candidate.ratio > best.ratio) best = candidate;
  }
  return best as IAccessibleStep;
}

/**
 * Extensión de preset para un color de marca (función PURA): rampa de 11 pasos + los tokens
 * `color/contrastColor/hover/active` con el paso que cumple WCAG AA en cada modo (`light-dark()`).
 * La usan `PrimaryColorService` (en vivo) y `initialThemePreset()` (arranque, sin destello).
 */
export function primaryPresetExtension(hex: string) {
  const steps = palette(hex) as unknown as TPaletteSteps;
  const light = pickAccessibleStep(steps, LIGHT_STEP_PREFERENCE, true);
  const dark = pickAccessibleStep(steps, DARK_STEP_PREFERENCE, false);
  const at = (base: IAccessibleStep, offset: number) => steps[stepAtOffset(base.step, offset)];
  return {
    semantic: {
      primary: {
        ...steps,
        color: `light-dark(${light.hex}, ${dark.hex})`,
        contrastColor: `light-dark(${light.textColor}, ${dark.textColor})`,
        hoverColor: `light-dark(${at(light, 1)}, ${at(dark, -1)})`,
        activeColor: `light-dark(${at(light, 2)}, ${at(dark, -2)})`,
      },
    },
  };
}

/**
 * Bordes de campos accesibles (WCAG 1.4.11, ≥ 3:1 contra la superficie). Los de Aura
 * (`surface.300` en claro, `surface.600` en oscuro) dan 1.48:1 y 2.29:1: el límite del control no
 * se distingue. Lo detectó la tabla de contraste de /style-guide.
 */
export const ACCESSIBLE_FORM_FIELD_PRESET = {
  semantic: {
    colorScheme: {
      light: { formField: { borderColor: '{surface.500}', hoverBorderColor: '{surface.600}' } },
      dark: { formField: { borderColor: '{surface.500}', hoverBorderColor: '{surface.400}' } },
    },
  },
};

/**
 * Preset de la app para un color: Aura + bordes accesibles + la extensión accesible. TAMBIÉN para el color por
 * defecto: el primario de Aura tal cual (esmeralda 500 + texto blanco) da 2.5:1 y NO cumple
 * WCAG AA — pasado por `primaryPresetExtension` usa el paso que sí cumple.
 */
export function appThemePreset(hex: string = DEFAULT_PRIMARY_HEX) {
  return definePreset(Aura, ACCESSIBLE_FORM_FIELD_PRESET, primaryPresetExtension(hex));
}

/**
 * Preset con el que ARRANCA `provideOptimus` (color guardado o el por defecto). Hace falta porque
 * `provideOptimus` aplica su preset DESPUÉS de que los servicios se construyen — un
 * `updatePreset()` en el constructor quedaba pisado (bug real: al recargar, el color elegido
 * volvía al predeterminado).
 */
export function initialThemePreset() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(PRIMARY_COLOR_STORAGE_KEY);
  } catch {
    // storage bloqueado → color por defecto
  }
  return appThemePreset(stored ?? DEFAULT_PRIMARY_HEX);
}
