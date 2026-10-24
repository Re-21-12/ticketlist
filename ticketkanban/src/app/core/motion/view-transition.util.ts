import type { ViewTransitionInfo } from '@angular/router';
import { REDUCED_MOTION_QUERY } from './motion.constants';

/**
 * `withViewTransitions({ onViewTransitionCreated })`:
 *  - Con «reducir movimiento» se salta la transición entre rutas (WCAG 2.3.3). El CSS de styles.css también la anula; esto
 *    evita además la captura de pantalla que hace el navegador.
 *  - Una transición que se salta (reducir movimiento, o una navegación nueva antes de que termine la anterior, o la pestaña
 *    en segundo plano) rechaza sus promesas `ready` y `finished` con `AbortError: Transition was skipped`. Es un resultado
 *    NORMAL, no un fallo: se atienden aquí para que no salgan como «Uncaught (in promise)» en la consola.
 */
export function skipTransitionIfReducedMotion({ transition }: ViewTransitionInfo): void {
  void transition.ready.catch(() => undefined);
  void transition.finished.catch(() => undefined);
  if (typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches) {
    transition.skipTransition();
  }
}
