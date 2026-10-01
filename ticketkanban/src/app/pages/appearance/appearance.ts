import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from '@openng/optimus-ui/button';
import { ColorPickerModule } from '@openng/optimus-ui/colorpicker';
import { ToggleSwitchModule } from '@openng/optimus-ui/toggleswitch';
import { FormSplit } from '../../layouts/form-split/form-split';
import { PrimaryColorService } from '../../core/theme/primary-color.service';
import { DEFAULT_PRIMARY_HEX, PRIMARY_COLOR_PRESETS } from '../../core/theme/theme.constants';
import { ThemeService } from '../../core/theme/theme.service';

/**
 * Apariencia (port de `AppearanceTab` de wallet-api): modo claro/oscuro + color principal. Acción
 * imperativa sobre dos valores (no un recurso CRUD) → sin `app-dynamic-form`, igual que en
 * wallet-api. Se aplica al instante y se guarda en este navegador; en wallet-api además se
 * persiste en la cuenta (pendiente aquí: endpoint `PATCH /api/bff/preferences`).
 */
@Component({
  selector: 'app-appearance',
  imports: [FormsModule, ButtonModule, ColorPickerModule, ToggleSwitchModule, FormSplit],
  templateUrl: './appearance.html',
  styleUrl: './appearance.css',
})
export class Appearance {
  /** `h2` cuando va dentro de «Mi perfil» (su `h1` es el nombre de la persona). */
  readonly $headingLevel = input<'h1' | 'h2'>('h1');

  protected readonly _themeService = inject(ThemeService);
  protected readonly _primaryColorService = inject(PrimaryColorService);

  protected readonly presets = PRIMARY_COLOR_PRESETS;

  /** Color efectivo (el elegido o el de marca por defecto), con '#'. */
  protected readonly $activeHex = computed(
    () => this._primaryColorService.$customColor() ?? DEFAULT_PRIMARY_HEX,
  );
  /** `p-colorpicker format="hex"` trabaja SIN '#': se quita/agrega solo en este borde. */
  protected readonly $pickerValue = computed(() => this.$activeHex().replace('#', ''));

  protected onPickerChange(hex: string | null | undefined): void {
    if (!hex) return;
    this._primaryColorService.set(hex.startsWith('#') ? hex : `#${hex}`);
  }

  protected selectPreset(hex: string): void {
    if (hex === DEFAULT_PRIMARY_HEX) this._primaryColorService.reset();
    else this._primaryColorService.set(hex);
  }
}
