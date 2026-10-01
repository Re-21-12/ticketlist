/**
 * Listas CERRADAS de íconos y colores de avatar. Espejo de
 * ticketlistbe/src/modules/users/avatar.const.ts (el backend valida contra la misma lista).
 * Los colores llevan texto blanco encima: todos tienen contraste ≥ 4.5:1 con #ffffff (WCAG 1.4.3).
 */
export const AVATAR_ICONS = [
  'pi-user',
  'pi-star',
  'pi-heart',
  'pi-bolt',
  'pi-cloud',
  'pi-compass',
  'pi-camera',
  'pi-bookmark',
  'pi-flag',
  'pi-sun',
  'pi-moon',
  'pi-bell',
] as const;

export const AVATAR_COLORS = [
  '#1d4ed8',
  '#047857',
  '#b45309',
  '#be123c',
  '#6d28d9',
  '#0e7490',
  '#c2410c',
  '#475569',
] as const;

/** Nombre accesible de cada color (el color solo no basta: WCAG 1.4.1). */
export const AVATAR_COLOR_LABELS: Record<(typeof AVATAR_COLORS)[number], string> = {
  '#1d4ed8': 'Azul',
  '#047857': 'Verde',
  '#b45309': 'Ámbar',
  '#be123c': 'Rojo',
  '#6d28d9': 'Violeta',
  '#0e7490': 'Turquesa',
  '#c2410c': 'Naranja',
  '#475569': 'Gris',
};

export const AVATAR_ICON_LABELS: Record<(typeof AVATAR_ICONS)[number], string> = {
  'pi-user': 'Persona',
  'pi-star': 'Estrella',
  'pi-heart': 'Corazón',
  'pi-bolt': 'Rayo',
  'pi-cloud': 'Nube',
  'pi-compass': 'Brújula',
  'pi-camera': 'Cámara',
  'pi-bookmark': 'Marcador',
  'pi-flag': 'Bandera',
  'pi-sun': 'Sol',
  'pi-moon': 'Luna',
  'pi-bell': 'Campana',
};

export type TAvatarIcon = (typeof AVATAR_ICONS)[number];
export type TAvatarColor = (typeof AVATAR_COLORS)[number];
