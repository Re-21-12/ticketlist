import { contrastRatio, WCAG_AA_NORMAL_TEXT } from '../utils/color-contrast.util';
import { primaryPresetExtension } from './primary-preset.util';
import { DEFAULT_PRIMARY_HEX, PRIMARY_COLOR_PRESETS } from './theme.constants';

/** 'light-dark(#aaa, #bbb)' → ['#aaa', '#bbb'] */
function lightDark(value: string): [string, string] {
  const [light, dark] = value.replace(/^light-dark\(|\)$/g, '').split(',').map((v) => v.trim());
  return [light, dark];
}

describe('primaryPresetExtension (WCAG AA)', () => {
  const colors = [
    DEFAULT_PRIMARY_HEX,
    ...PRIMARY_COLOR_PRESETS.map((p) => p.hex),
    '#ffff00', // amarillo puro: el caso más difícil en modo claro
    '#00ffcc',
  ];

  it.each(colors)('%s: botón primario ≥ 4.5:1 en claro y en oscuro', (hex) => {
    const { primary } = primaryPresetExtension(hex).semantic;
    const [bgLight, bgDark] = lightDark(primary.color);
    const [fgLight, fgDark] = lightDark(primary.contrastColor);
    expect(contrastRatio(bgLight, fgLight)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
    expect(contrastRatio(bgDark, fgDark)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it('el esmeralda por defecto de Aura (500 + blanco) NO cumple: por eso pasa por la extensión', () => {
    expect(contrastRatio('#10b981', '#ffffff')).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });
});
