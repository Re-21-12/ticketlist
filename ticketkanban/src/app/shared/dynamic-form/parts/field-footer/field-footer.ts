import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MessageModule } from '@openng/optimus-ui/message';

/**
 * Pie de un campo (port del `field-footer` de `dynamic-field-signal` de wallet-api). Muestra UNA
 * cosa a la vez, por prioridad: razones de deshabilitado → error → hint. El contador «n / máx» de
 * los textos acompaña siempre a la derecha (también con error o deshabilitado: es lo que controla
 * la escritura). Siempre reserva su altura mínima para que aparecer/desaparecer un error no
 * desplace el resto del formulario.
 */
@Component({
  selector: 'app-field-footer',
  imports: [MessageModule, NgTemplateOutlet],
  templateUrl: './field-footer.html',
  styleUrl: './field-footer.css',
})
export class FieldFooter {
  readonly $hint = input('');
  /** `id` del bloque del hint: el control lo referencia con `aria-describedby`. */
  readonly $hintId = input('');
  readonly $errorMessage = input('');
  /** `id` del bloque de error: el control lo referencia con `aria-describedby`. */
  readonly $errorId = input('');
  readonly $showError = input(false);
  readonly $disabledReasons = input<readonly string[]>([]);
  readonly $currentLength = input<number | null>(null);
  readonly $maxLength = input<number | null>(null);

  protected readonly $hasCounter = computed(
    () => this.$currentLength() !== null && this.$maxLength() !== null,
  );
  /** Contador cerca del límite (≥ 90 %): se resalta para avisar antes de que el campo se bloquee. */
  protected readonly $nearLimit = computed(() => {
    const max = this.$maxLength();
    const current = this.$currentLength();
    return max !== null && current !== null && current >= max * 0.9;
  });
}
