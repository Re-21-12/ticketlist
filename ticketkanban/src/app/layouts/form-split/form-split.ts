import { Component, input } from '@angular/core';

/**
 * Layout de pantallas con formulario (port de `FormSplit` de wallet-api): contexto/arte a la
 * izquierda, formulario a la DERECHA (mano dominante). El ancho del form se fija en un solo lugar
 * (`--form-split-width`, 26rem) para que un form corto no se estire a todo el ancho de la card.
 *
 * ```html
 * <app-form-split [$heading]="'Nuevo ticket'" [$description]="'…'">
 *   <ul formSplitExtra>…</ul>
 *   <app-dynamic-form … />
 * </app-form-split>
 * ```
 */
@Component({
  selector: 'app-form-split',
  templateUrl: './form-split.html',
  styleUrl: './form-split.css',
})
export class FormSplit {
  readonly $heading = input.required<string>();
  /** `h2` cuando el formulario va dentro de una página que ya tiene su `h1` (pestañas del perfil). */
  readonly $headingLevel = input<'h1' | 'h2'>('h1');
  readonly $description = input('');
}
