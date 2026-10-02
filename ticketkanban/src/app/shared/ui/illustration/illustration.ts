import { Component, input } from '@angular/core';
import type { TIllustration } from './illustration.types';

/**
 * Ilustración decorativa (SVG inline, como en wallet-api): vive en un componente y no en un `.svg` + `<img>`
 * porque el color de marca cambia con el tema y con el color del usuario, y un `<img>` no hereda
 * `currentColor` ni las variables CSS del documento. Es puramente decorativa: `aria-hidden`, sin texto.
 * El título y la descripción de la pantalla ya dicen lo mismo con palabras.
 */
@Component({
  selector: 'app-illustration',
  templateUrl: './illustration.html',
  styleUrl: './illustration.css',
})
export class Illustration {
  readonly $name = input.required<TIllustration>();
}
