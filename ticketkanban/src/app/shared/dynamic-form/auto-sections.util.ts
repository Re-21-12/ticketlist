import type { IFieldConfig } from './field-config.interface';
import type { IFormSection } from './form-definition.interface';

/**
 * Reparto balanceado de campos en secciones cuando el form supera `threshold` y no declara las
 * suyas (9 campos → [5,4], nunca [5,4] mal cortado a [8,1]). Mismo algoritmo que wallet-api.
 */
export function computeAutoSections(
  fields: readonly IFieldConfig[],
  size = 5,
  threshold = 6,
): IFormSection[] | null {
  if (fields.length <= threshold) return null;

  const numSections = Math.ceil(fields.length / size);
  const baseSize = Math.floor(fields.length / numSections);
  const remainder = fields.length % numSections;

  const sections: IFormSection[] = [];
  let cursor = 0;
  for (let i = 0; i < numSections; i++) {
    const chunkSize = baseSize + (i < remainder ? 1 : 0);
    sections.push({
      key: `auto-section-${i}`,
      label: `Sección ${i + 1}`,
      fieldKeys: fields.slice(cursor, cursor + chunkSize).map((f) => f.key),
    });
    cursor += chunkSize;
  }
  return sections;
}
