import { Component } from '@angular/core';
import { Appearance } from '../../appearance/appearance';

/**
 * Pestaña «Apariencia»: la MISMA pantalla de `/appearance` (modo y color de marca), sin duplicarla,
 * con su encabezado como `h2` porque dentro del perfil el `h1` es el nombre de la persona.
 */
@Component({
  selector: 'app-appearance-tab',
  imports: [Appearance],
  templateUrl: './appearance-tab.html',
  styleUrl: './appearance-tab.css',
})
export class AppearanceTab {}
