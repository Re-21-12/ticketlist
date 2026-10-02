import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Shell de las pantallas de acceso (iniciar sesión, crear cuenta, recuperar): una tarjeta centrada, SIN
 * barra lateral ni menú (quien llega aquí todavía no tiene sesión). Mantiene el «Saltar al contenido»
 * y el `<main>` como punto de referencia para lectores de pantalla.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
})
export class AuthLayout {}
