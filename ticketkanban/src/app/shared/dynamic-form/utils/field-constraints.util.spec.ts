import * as z from 'zod';
import { TICKET_FORM } from '../../../pages/tickets/ticket-form.config';
import { FieldType, type IFieldConfig } from '../field-config.interface';
import {
  deriveAllConstraints,
  deriveConstraints,
  isRequired,
  probeMessage,
} from './field-constraints.util';

const field = (key: string, type: IFieldConfig['type'] = FieldType.TEXT): IFieldConfig => ({
  key,
  label: key,
  type,
});

describe('deriveConstraints (todo sale del schema Zod)', () => {
  const schema = z.object({
    name: z.string().trim().min(3).max(40),
    bio: z.string().max(200).optional(),
    nick: z.string().max(10).default(''),
    maybe: z.string().max(15).nullable(),
    hours: z.number().int().min(1).max(200).nullable(),
    flag: z.boolean(),
    free: z.string(),
  });

  it('lee mínimo y máximo de caracteres', () => {
    expect(deriveConstraints(schema, field('name'))).toMatchObject({
      minLength: 3,
      maxLength: 40,
      required: true,
    });
  });

  it('atraviesa optional / default / nullable (el máximo sigue ahí)', () => {
    expect(deriveConstraints(schema, field('bio')).maxLength).toBe(200);
    expect(deriveConstraints(schema, field('nick')).maxLength).toBe(10);
    expect(deriveConstraints(schema, field('maybe')).maxLength).toBe(15);
  });

  it('lee límites numéricos', () => {
    expect(deriveConstraints(schema, field('hours', FieldType.INTEGER))).toMatchObject({
      minimum: 1,
      maximum: 200,
    });
  });

  it('un campo sin límites no inventa ninguno', () => {
    expect(deriveConstraints(schema, field('free'))).toMatchObject({
      minLength: null,
      maxLength: null,
    });
  });

  it('una clave que no está en el schema no rompe', () => {
    expect(deriveConstraints(schema, field('fantasma')).required).toBe(false);
  });
});

describe('isRequired', () => {
  it('deduce la obligatoriedad sin `state.required` en la config', () => {
    expect(isRequired(z.string().min(1), field('a'))).toBe(true);
    expect(isRequired(z.string().optional(), field('a'))).toBe(false);
    expect(isRequired(z.string().default(''), field('a'))).toBe(false);
  });

  it('un multiselect vacío es válido (no obligatorio) salvo que el schema exija al menos uno', () => {
    expect(isRequired(z.array(z.string()).max(3), field('t', FieldType.MULTISELECT))).toBe(false);
    expect(isRequired(z.array(z.string()).min(1), field('t', FieldType.MULTISELECT))).toBe(true);
  });

  it('un switch nunca es obligatorio; un checkbox lo es solo si exige `true`', () => {
    expect(isRequired(z.boolean(), field('t', FieldType.TOGGLE))).toBe(false);
    expect(isRequired(z.boolean(), field('c', FieldType.CHECKBOX))).toBe(false);
    expect(isRequired(z.literal(true), field('c', FieldType.CHECKBOX))).toBe(true);
  });
});

describe('probeMessage', () => {
  it('devuelve el mensaje que Zod da a ese valor, o undefined si pasa', () => {
    const schema = z.string().max(3, { error: 'Muy largo' });
    expect(probeMessage(schema, 'abcd')).toBe('Muy largo');
    expect(probeMessage(schema, 'abc')).toBeUndefined();
  });
});

describe('restricciones del formulario de tickets (lo que ve el usuario)', () => {
  const constraints = deriveAllConstraints(TICKET_FORM.schema, TICKET_FORM.fields);

  it('título: 120 caracteres (contador «n / 120») y obligatorio', () => {
    expect(constraints.get('title')).toMatchObject({ required: true, maxLength: 120 });
  });

  it('descripción: 2000 caracteres y opcional', () => {
    expect(constraints.get('description')).toMatchObject({ required: false, maxLength: 2000 });
  });

  it('estimación: entero entre 1 y 200', () => {
    expect(constraints.get('estimateHours')).toMatchObject({ minimum: 1, maximum: 200 });
  });
});
