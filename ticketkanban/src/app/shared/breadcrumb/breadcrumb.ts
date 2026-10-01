import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IBreadcrumbItem } from './breadcrumb.interface';

/**
 * Breadcrumb accesible (patrón WAI-ARIA APG «Breadcrumb»): `<nav aria-label>` + lista ordenada,
 * página actual con `aria-current="page"` y separadores ocultos al lector de pantalla.
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css',
})
export class Breadcrumb {
  readonly $items = input.required<IBreadcrumbItem[]>();
  readonly $ariaLabel = input('Ruta de navegación');
  /**
   * Oculta la lista en pantallas angostas (criterio de wallet-api para el topbar: no entra junto a
   * los controles y el `<h1>` de la página ya dice dónde está el usuario).
   */
  readonly $collapseOnMobile = input(false);
}
