import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideOptimus } from '@openng/optimus-ui/config';
import * as z from 'zod';
import { FieldType, type IFieldOption } from './field-config.interface';
import { DynamicForm } from './dynamic-form';
import { defineForm } from './form-definition.interface';
import { SELECT_AUTOCOMPLETE_THRESHOLD } from './dynamic-field/dynamic-field';

const options = (count: number): IFieldOption[] =>
  Array.from({ length: count }, (_, i) => ({ value: `v${i}`, label: `Opción ${i}` }));

const FORM = defineForm({
  name: 'OPTIONS_FORM',
  schema: z.object({ who: z.string().default('') }),
  fields: [{ key: 'who', label: 'Persona', type: FieldType.SELECT, options: [{ value: '', label: 'Sin asignar' }] }],
});

@Component({
  selector: 'app-options-host',
  imports: [DynamicForm],
  template: `<app-dynamic-form [$definition]="form" [$optionsByField]="$byField()" />`,
})
class OptionsHost {
  readonly form = FORM;
  readonly $byField = signal<Record<string, IFieldOption[]>>({});
}

describe('SELECT: autocomplete con MÁS de 5 opciones y opciones en runtime', () => {
  async function render() {
    TestBed.configureTestingModule({ providers: [provideOptimus({})] });
    const fixture = TestBed.createComponent(OptionsHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const kind = () =>
      root.querySelector('p-autocomplete') ? 'autocomplete' : root.querySelector('p-select') ? 'select' : 'ninguno';
    const set = async (value: Record<string, IFieldOption[]>) => {
      fixture.componentInstance.$byField.set(value);
      await fixture.whenStable();
    };
    return { kind, set };
  }

  it('el umbral es 5', () => {
    expect(SELECT_AUTOCOMPLETE_THRESHOLD).toBe(5);
  });

  it('con las opciones de la config (1) es un select', async () => {
    const { kind } = await render();
    expect(kind()).toBe('select');
  });

  it('hasta 5 opciones sigue siendo select; con 6 pasa a autocomplete', async () => {
    const { kind, set } = await render();
    await set({ who: options(5) });
    expect(kind()).toBe('select');
    await set({ who: options(6) });
    expect(kind()).toBe('autocomplete');
  });

  it('las opciones que llegan en runtime REEMPLAZAN a las de la config y reaccionan cuando cambian', async () => {
    const { kind, set } = await render();
    await set({ who: options(8) });
    expect(kind()).toBe('autocomplete');
    // Terminó de cargar con menos personal: vuelve a select sin recrear el formulario.
    await set({ who: options(3) });
    expect(kind()).toBe('select');
  });
});
