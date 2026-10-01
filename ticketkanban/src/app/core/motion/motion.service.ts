import { DestroyRef, inject, Service, signal } from '@angular/core';
import { MOTION_MS, MOTION_STAGGER_MAX_ITEMS, REDUCED_MOTION_QUERY } from './motion.constants';

/**
 * Animaciones imperativas con anime.js (coreografías que CSS no expresa bien: stagger, secuencias).
 * Para entrar/salir de un elemento usar `animate.enter` / `animate.leave` de Angular (CSS), no esto.
 *
 * - anime.js se importa LAZY: no entra al bundle inicial.
 * - WCAG 2.3.3: con «reducir movimiento» no se anima nada (`$reducedMotion`, reactivo al cambio del SO).
 * - Solo `opacity` y `transform` (no disparan layout) y siempre terminan en el estado natural del
 *   elemento: si la animación no corre, el contenido igual queda visible.
 */
@Service()
export class MotionService {
  private readonly $_reducedMotion = signal(false);
  readonly $reducedMotion = this.$_reducedMotion.asReadonly();

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(REDUCED_MOTION_QUERY);
    this.$_reducedMotion.set(query.matches);
    const onChange = (event: MediaQueryListEvent) => this.$_reducedMotion.set(event.matches);
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }

  /** Entrada escalonada (lista, tarjetas). Devuelve cuando termina (o de inmediato si no anima). */
  async staggerIn(targets: readonly Element[]): Promise<void> {
    const items = targets.slice(0, MOTION_STAGGER_MAX_ITEMS);
    if (this.$_reducedMotion() || items.length === 0) return;
    const { animate, stagger } = await import('animejs');
    await animate(items as Element[], {
      opacity: { from: 0 },
      translateY: { from: '0.5rem' },
      duration: MOTION_MS.base,
      delay: stagger(MOTION_MS.stagger),
      ease: 'outCubic',
    });
  }

  /** Llama la atención sobre un elemento (p. ej. un contador que cambió) sin moverlo de lugar. */
  async pulse(target: Element): Promise<void> {
    if (this.$_reducedMotion()) return;
    const { animate } = await import('animejs');
    await animate(target, { scale: [1, 1.08, 1], duration: MOTION_MS.base * 2, ease: 'inOutSine' });
  }
}
