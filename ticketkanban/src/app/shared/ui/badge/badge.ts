import { Component, computed, input } from '@angular/core';
import { TagModule } from '@openng/optimus-ui/tag';
import type { TBadgeSeverity } from './badge.types';

/**
 * Insignia: texto + ícono + color. El TEXTO va siempre (el color y el ícono refuerzan, nunca son la única
 * señal — WCAG 1.4.1) y el ícono es decorativo (`aria-hidden`).
 */
@Component({
  selector: 'app-badge',
  imports: [TagModule],
  templateUrl: './badge.html',
  styleUrl: './badge.css',
})
export class Badge {
  readonly $label = input.required<string>();
  /** Clase PrimeIcons con o sin el prefijo `pi` (`pi-clock` o `pi pi-clock`). */
  readonly $icon = input<string | null | undefined>(null);
  readonly $severity = input<TBadgeSeverity | null | undefined>(null);

  protected readonly $iconClass = computed(() => {
    const icon = this.$icon();
    if (!icon) return null;
    return icon.startsWith('pi ') ? icon : `pi ${icon}`;
  });
  /** `secondary` es el neutro del tema cuando no hay color elegido. */
  protected readonly $tagSeverity = computed(() => this.$severity() ?? 'secondary');
}
