import { Component, input } from '@angular/core';
import { TooltipModule } from '@openng/optimus-ui/tooltip';

/**
 * Etiqueta de un campo: nombre + «*» con tooltip si es obligatorio, o «(Opcional)» si no (criterio
 * de wallet-api: sin marca, la gente no sabe qué hacer con los campos opcionales). El `<label>` se
 * asocia al control con `for`/`id` (WCAG 1.3.1 / 3.3.2); para un grupo (radios, slider) se omite
 * `for` y el grupo se refiere al label por `aria-labelledby`.
 */
@Component({
  selector: 'app-field-label',
  imports: [TooltipModule],
  templateUrl: './field-label.html',
  styleUrl: './field-label.css',
})
export class FieldLabel {
  readonly $label = input.required<string>();
  /** `id` del control que etiqueta; `null` para grupos sin un único control. */
  readonly $forId = input<string | null>(null);
  /** `id` del propio `<label>` (lo referencian los grupos con `aria-labelledby`). */
  readonly $labelId = input<string | null>(null);
  readonly $required = input(false);
  /** Muestra «(Opcional)» en los campos no obligatorios. */
  readonly $showOptional = input(true);
  /** Clase de ícono de contexto antes del nombre (CHECKBOX/TOGGLE, que no llevan inputgroup). */
  readonly $icon = input('');
}
