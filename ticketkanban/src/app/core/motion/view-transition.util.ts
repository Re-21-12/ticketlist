import type { ViewTransitionInfo } from '@angular/router';
import { REDUCED_MOTION_QUERY } from './motion.constants';

/**
 * `withViewTransitions({ onViewTransitionCreated })`: con «reducir movimiento» se salta la
 * transición entre rutas (WCAG 2.3.3). El CSS de styles.css también la anula; esto evita además
 * la captura de pantalla que hace el navegador.
 */
export function skipTransitionIfReducedMotion({ transition }: ViewTransitionInfo): void {
  if (typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION_QUERY).matches) {
    transition.skipTransition();
  }
}
