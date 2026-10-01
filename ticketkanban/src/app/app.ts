import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Componente standalone (no ConfirmDialogModule): @defer solo difiere dependencias standalone.
import { ConfirmDialog } from '@openng/optimus-ui/confirmdialog';
import { ToastModule } from '@openng/optimus-ui/toast';

/** Raíz: router + overlays globales (toast y confirmación) — un solo lugar, no uno por pantalla. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastModule, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
