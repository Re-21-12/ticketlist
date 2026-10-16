import { Component, input } from '@angular/core';

/** Un dato de la tarjeta: etiqueta + valor ya formateado. */
export interface ISummaryFact {
  label: string;
  value: string;
}

/** Contenido de `app-summary-card`: título, datos clave y, opcionalmente, un texto destacado (p. ej. la solución aplicada). */
export interface ISummaryCard {
  title: string;
  /** Línea breve bajo el título. */
  subtitle?: string;
  facts: readonly ISummaryFact[];
  note?: { label: string; text: string };
}

/**
 * Tarjeta de resumen (pantalla «Cierre del ticket» del diseño): lo esencial de un caso de un vistazo. La usan la encuesta
 * de cierre, el diálogo de «Reabrir» y el detalle de un ticket cerrado. Es una región con nombre (`aria-labelledby`).
 */
@Component({
  selector: 'app-summary-card',
  templateUrl: './summary-card.html',
  styleUrl: './summary-card.css',
})
export class SummaryCard {
  readonly $card = input.required<ISummaryCard>();
  readonly $icon = input('pi-check-circle');
}
