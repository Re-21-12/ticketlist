import type { IBadgeMeta } from '../../ui/badge/badge.types';
import type { IFieldOption } from '../field-config.interface';

/** Ícono y color de cada valor (sin la etiqueta: esa ya viene en las opciones). */
export type TBadgeStyle = Pick<IBadgeMeta, 'icon' | 'severity'>;

/** Agrega ícono y color a opciones que ya tienen etiqueta (columnas con `badge: true`). */
export function withBadges(options: readonly IFieldOption[], styles: Readonly<Record<string, TBadgeStyle>>): IFieldOption[] {
  return options.map((option) => ({
    ...option,
    icon: styles[String(option.value)]?.icon ?? null,
    severity: styles[String(option.value)]?.severity ?? null,
  }));
}
