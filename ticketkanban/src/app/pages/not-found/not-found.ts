import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from '@openng/optimus-ui/button';
import { Illustration } from '../../shared/ui/illustration/illustration';

/**
 * Destino del comodín `**`: una URL que no existe (`/asdf`). Se pinta dentro de `AuthLayout` (sin menú, sirve con o sin
 * sesión) y ofrece volver al inicio; si hay sesión el inicio es el tablero y si no, el guard lo manda a iniciar sesión.
 */
@Component({
  selector: 'app-not-found',
  imports: [Illustration, RouterLink, ButtonModule],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFound {}
