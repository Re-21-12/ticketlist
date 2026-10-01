import type { IFieldConfig } from '../field-config.interface';
import type { IFormSection } from '../form-definition.interface';

export interface ISectionProblem {
  kind: 'unknown-field' | 'duplicate-field' | 'orphan-field' | 'duplicate-section';
  message: string;
}

/**
 * Revisa que las secciones declaradas calcen con los campos: cada campo en UNA sola sección. Sin
 * esta revisión un campo repetido en dos secciones se pinta dos veces (y duplica su `id`), uno en
 * ninguna desaparece sin avisar, y una clave mal escrita se ignora en silencio.
 */
export function findSectionProblems(
  fields: readonly Pick<IFieldConfig, 'key'>[],
  sections: readonly Pick<IFormSection, 'key' | 'label' | 'fieldKeys'>[],
): ISectionProblem[] {
  const problems: ISectionProblem[] = [];
  const known = new Set(fields.map((f) => f.key));
  const placedIn = new Map<string, string>();
  const sectionKeys = new Set<string>();

  for (const section of sections) {
    if (sectionKeys.has(section.key)) {
      problems.push({ kind: 'duplicate-section', message: `La sección «${section.key}» está declarada más de una vez` });
    }
    sectionKeys.add(section.key);

    for (const key of section.fieldKeys) {
      if (!known.has(key)) {
        problems.push({ kind: 'unknown-field', message: `La sección «${section.key}» menciona «${key}», que no es un campo del formulario` });
        continue;
      }
      const first = placedIn.get(key);
      if (first) {
        problems.push({ kind: 'duplicate-field', message: `El campo «${key}» está en dos secciones («${first}» y «${section.key}»): se pintaría dos veces` });
      } else {
        placedIn.set(key, section.key);
      }
    }
  }

  for (const key of known) {
    if (!placedIn.has(key)) {
      problems.push({ kind: 'orphan-field', message: `El campo «${key}» no está en ninguna sección: no se mostraría` });
    }
  }
  return problems;
}

/** Lanza si las secciones no calzan con los campos (se llama al definir el formulario). */
export function assertValidSections(
  formName: string,
  fields: readonly Pick<IFieldConfig, 'key'>[],
  sections: readonly Pick<IFormSection, 'key' | 'label' | 'fieldKeys'>[] | undefined,
): void {
  if (!sections?.length) return;
  const problems = findSectionProblems(fields, sections);
  if (problems.length) {
    throw new Error(`Formulario «${formName}» con secciones inválidas:\n- ${problems.map((p) => p.message).join('\n- ')}`);
  }
}
