import { TestBed } from '@angular/core/testing';
import { provideOptimus } from '@openng/optimus-ui/config';
import { DynamicForm } from '../../shared/dynamic-form/dynamic-form';
import { FieldType } from '../../shared/dynamic-form/field-config.interface';
import { FIELD_GALLERY_FORM } from './field-gallery.config';

describe('Galería de campos', () => {
  it('declara un campo de CADA tipo de control que sabe pintar app-dynamic-field', () => {
    const used = new Set(FIELD_GALLERY_FORM.fields.map((field) => field.type));
    const missing = Object.values(FieldType).filter((type) => !used.has(type));
    expect(missing, `tipos sin demo en la galería: ${missing.join(', ')}`).toEqual([]);
  });

  it('se renderiza completa: un host por campo y ningún error en consola', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => void errors.push(args));
    TestBed.configureTestingModule({ providers: [provideOptimus({})] });
    const fixture = TestBed.createComponent(DynamicForm);
    fixture.componentRef.setInput('$definition', FIELD_GALLERY_FORM);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('app-dynamic-field').length).toBe(FIELD_GALLERY_FORM.fields.length);
    // Cada campo está en UNA sola sección: ningún id repetido en el DOM.
    const ids = [...root.querySelectorAll('[id]')].map((el) => el.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicated, `ids repetidos: ${duplicated.join(', ')}`).toEqual([]);
    spy.mockRestore();
    expect(errors).toEqual([]);
  });
});
