/** Colores de insignia: las severidades del tema (siguen el modo claro/oscuro y el color de marca). */
export const BADGE_SEVERITIES = ['secondary', 'info', 'success', 'warn', 'danger', 'contrast'] as const;
export type TBadgeSeverity = (typeof BADGE_SEVERITIES)[number];

/** Lo mínimo para pintar una opción como insignia: texto + ícono + color. */
export interface IBadgeMeta {
  label: string;
  /** Clase PrimeIcons (`pi-clock`). */
  icon?: string | null;
  severity?: TBadgeSeverity | null;
}
