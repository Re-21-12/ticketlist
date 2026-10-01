import * as z from 'zod';
import { TICKET_FORM } from '../../../pages/tickets/ticket-form.config';
import { FieldType } from '../field-config.interface';
import { defineForm } from '../form-definition.interface';
import { findSectionProblems } from './form-sections.util';

const fields = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

describe('findSectionProblems', () => {
  it('secciones correctas: sin problemas', () => {
    expect(
      findSectionProblems(fields, [
        { key: 's1', label: 'Uno', fieldKeys: ['a', 'b'] },
        { key: 's2', label: 'Dos', fieldKeys: ['c'] },
      ]),
    ).toEqual([]);
  });

  it('un campo en DOS secciones se pintaría dos veces', () => {
    const problems = findSectionProblems(fields, [
      { key: 's1', label: 'Uno', fieldKeys: ['a', 'b'] },
      { key: 's2', label: 'Dos', fieldKeys: ['b', 'c'] },
    ]);
    expect(problems.map((p) => p.kind)).toEqual(['duplicate-field']);
    expect(problems[0].message).toContain('«b»');
  });

  it('un campo en NINGUNA sección desaparece de la pantalla', () => {
    const problems = findSectionProblems(fields, [
      { key: 's1', label: 'Uno', fieldKeys: ['a', 'b'] },
    ]);
    expect(problems.map((p) => p.kind)).toEqual(['orphan-field']);
  });

  it('una clave inexistente (typo) se avisa en vez de ignorarse', () => {
    const problems = findSectionProblems(fields, [
      { key: 's1', label: 'Uno', fieldKeys: ['a', 'b', 'c', 'z'] },
    ]);
    expect(problems.map((p) => p.kind)).toEqual(['unknown-field']);
  });

  it('una sección declarada dos veces', () => {
    const problems = findSectionProblems(fields, [
      { key: 's1', label: 'Uno', fieldKeys: ['a'] },
      { key: 's1', label: 'Otra', fieldKeys: ['b', 'c'] },
    ]);
    expect(problems.map((p) => p.kind)).toContain('duplicate-section');
  });
});

describe('defineForm', () => {
  const schema = z.object({ a: z.string(), b: z.string() });

  it('falla al DEFINIR el formulario, con su nombre, si una sección está mal', () => {
    expect(() =>
      defineForm({
        name: 'FORM_ROTO',
        schema,
        fields: [
          { key: 'a', label: 'A', type: FieldType.TEXT },
          { key: 'b', label: 'B', type: FieldType.TEXT },
        ],
        sections: [
          { key: 's1', label: 'Uno', fieldKeys: ['a', 'b'] },
          { key: 's2', label: 'Dos', fieldKeys: ['b'] },
        ],
      }),
    ).toThrow(/FORM_ROTO[\s\S]*«b»/);
  });

  it('el formulario real de tickets no repite ni deja campos sueltos', () => {
    expect(findSectionProblems(TICKET_FORM.fields, TICKET_FORM.sections ?? [])).toEqual([]);
  });
});
