/**
 * Avatares del perfil: listas CERRADAS (el backend las valida; nunca se guarda un color o una clase
 * arbitraria que luego se pinte en el DOM de otra persona). Espejo de
 * ticketkanban/src/app/core/ui/user-avatar/avatar.const.ts.
 *
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

export type TAvatarIcon = (typeof AVATAR_ICONS)[number];
export type TAvatarColor = (typeof AVATAR_COLORS)[number];
