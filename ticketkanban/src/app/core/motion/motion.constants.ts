/** Tokens de movimiento en ms (espejo de `--app-motion-*` de styles.css, para anime.js). */
export const MOTION_MS = { fast: 150, base: 220, stagger: 40 } as const;

/** Tope de elementos animados en un stagger: más allá, la espera total molesta más de lo que ayuda. */
export const MOTION_STAGGER_MAX_ITEMS = 12;

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
