import type { IBadgeMeta } from '../../ui/badge/badge.types';
import type { IFieldOption } from '../field-config.interface';

/** Opciones de un select derivadas de los valores de un enum del contrato y su tabla de etiquetas. */
export function toOptions<T extends string>(values: readonly T[], labels: Record<T, string>): IFieldOption[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** Igual, pero con ícono y color (insignias): a partir de la tabla de metadatos de cada valor. */
export function toMetaOptions<T extends string>(values: readonly T[], meta: Record<T, IBadgeMeta>): IFieldOption[] {
  return values.map((value) => ({ value, label: meta[value].label, icon: meta[value].icon ?? null, severity: meta[value].severity ?? null }));
}
