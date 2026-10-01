/** Pasos de la rampa que genera `palette()` (mismo formato que los primitivos del preset). */
export type TPaletteStep =
  | '50'
  | '100'
  | '200'
  | '300'
  | '400'
  | '500'
  | '600'
  | '700'
  | '800'
  | '900'
  | '950';

export type TPaletteSteps = Record<TPaletteStep, string>;
