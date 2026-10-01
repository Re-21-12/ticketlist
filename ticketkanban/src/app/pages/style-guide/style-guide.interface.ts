/** Criterio de conformidad WCAG 2.2 y cómo lo cumple este proyecto. */
export interface IWcagCriterion {
  /** Número del criterio: '1.4.3'. */
  code: string;
  name: string;
  level: 'A' | 'AA' | 'AAA';
  howWeMeet: string;
}

/** Sección de la guía: ancla del índice + criterios que aplica + qué hacer y qué evitar. */
export interface IGuideSection {
  id: string;
  title: string;
  criteria: IWcagCriterion[];
  do: string[];
  avoid: string[];
}

/** Par de colores a verificar: primer plano sobre fondo, con el mínimo que exige WCAG. */
export interface IContrastPair {
  label: string;
  foreground: string;
  background: string;
  /** 4.5 texto normal (1.4.3) · 3 componentes de interfaz y foco (1.4.11). */
  minimum: number;
}

export interface IContrastResult extends IContrastPair {
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  passes: boolean;
}
