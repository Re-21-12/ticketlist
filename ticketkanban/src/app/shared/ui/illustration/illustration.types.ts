/** Escenas disponibles de `app-illustration` (una por tipo de pantalla o estado vacío). */
export const ILLUSTRATIONS = [
  'tickets',
  'new-ticket',
  'list',
  'security',
  'two-factor',
  'recovery',
  'lock',
  'access',
  'users',
  'catalog',
  'audit',
  'metrics',
  'sharing',
  'empty',
  'survey',
  'menu',
  'matrix',
  'profile',
  'appearance',
] as const;
export type TIllustration = (typeof ILLUSTRATIONS)[number];
