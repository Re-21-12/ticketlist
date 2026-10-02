import { Component, computed, DestroyRef, inject, input } from '@angular/core';
import { ClockService } from './clock.service';
import { formatElapsed } from './format-elapsed';

/**
 * Reloj de tiempo transcurrido desde `$since` (p. ej. cuánto lleva un ticket en atención). El texto
 * tiene un nombre accesible completo y NO se anuncia cada segundo (`role="timer"` es `aria-live="off"`).
 */
@Component({
  selector: 'app-elapsed-clock',
  templateUrl: './elapsed-clock.html',
  styleUrl: './elapsed-clock.css',
})
export class ElapsedClock {
  private readonly _clock = inject(ClockService);

  readonly $since = input.required<Date | string | number>();
  readonly $label = input('En atención desde hace');

  protected readonly $text = computed(() => formatElapsed(this._clock.$now() - new Date(this.$since()).getTime()));

  constructor() {
    inject(DestroyRef).onDestroy(this._clock.subscribe());
  }
}
