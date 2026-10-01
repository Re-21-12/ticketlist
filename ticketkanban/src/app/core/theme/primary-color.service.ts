import { Service, signal } from '@angular/core';
import { updatePreset, usePreset } from '@openng/optimus-ui-themes';
import { appThemePreset, primaryPresetExtension } from './primary-preset.util';
import { PRIMARY_COLOR_STORAGE_KEY } from './theme.constants';

/**
 * Color de marca elegido por el usuario (port de `PrimaryColorService` de wallet-api).
 *
 * El usuario elige UN color; `primaryPresetExtension()` genera la rampa y elige, por modo, el
 * paso que pasa 4.5:1 (WCAG AA) contra el texto del botón — un amarillo o verde claro usado tal
 * cual dejaría botones ilegibles. `updatePreset()` reescribe `--p-primary-*` en vivo.
 *
 * El color GUARDADO no se aplica aquí sino en el preset inicial de `provideOptimus`
 * (`initialThemePreset()` en app.config.ts): aplicarlo en el constructor quedaba pisado.
 */
@Service()
export class PrimaryColorService {
  private readonly $_customColor = signal<string | null>(this.readInitial());
  readonly $customColor = this.$_customColor.asReadonly();

  set(hex: string): void {
    this.$_customColor.set(hex);
    this.persist(hex);
    updatePreset(primaryPresetExtension(hex));
  }

  /** Vuelve al color por defecto. `usePreset` REEMPLAZA (no mezcla): `updatePreset(Aura)` dejaba
   *  vivos los tokens `primary.color/…` agregados, que Aura no define → no se revertía (bug real). */
  reset(): void {
    this.$_customColor.set(null);
    this.persist(null);
    usePreset(appThemePreset());
  }

  private persist(hex: string | null): void {
    try {
      if (hex) localStorage.setItem(PRIMARY_COLOR_STORAGE_KEY, hex);
      else localStorage.removeItem(PRIMARY_COLOR_STORAGE_KEY);
    } catch {
      // storage bloqueado: vale solo para esta sesión
    }
  }

  private readInitial(): string | null {
    try {
      return localStorage.getItem(PRIMARY_COLOR_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
