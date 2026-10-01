import type { Routes } from '@angular/router';

/**
 * Primeros segmentos de URL que el router SABE atender (`tickets`, `appearance`…). Las rutas hijas de
 * un shell sin path (`path: ''` con `children`, como el layout) cuentan como de primer nivel; el
 * comodín `**` no cuenta: justamente es lo que se traga las URLs que no existen.
 */
export function routableRoots(config: Routes): ReadonlySet<string> {
  const roots = new Set<string>();
  for (const route of config) {
    if (route.path === '**' || route.path === undefined) continue;
    if (route.path === '' && route.children) {
      for (const root of routableRoots(route.children)) roots.add(root);
    } else if (route.path !== '') {
      roots.add(route.path.split('/')[0]);
    }
  }
  return roots;
}

/** ¿La URL (`/tickets/list`) cae en una pantalla real? Sin esto un enlace muerto redirige en silencio. */
export function isRoutable(url: string, roots: ReadonlySet<string>): boolean {
  return roots.has(url.split(/[/?#]/).filter(Boolean)[0] ?? '');
}
