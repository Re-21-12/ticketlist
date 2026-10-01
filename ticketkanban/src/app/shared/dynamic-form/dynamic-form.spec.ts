import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideOptimus } from '@openng/optimus-ui/config';
import { TICKET_QUICK_FORM } from '../../pages/tickets/ticket-form.config';
import { DynamicForm } from './dynamic-form';

/**
 * Comportamiento visible de cada campo (pedido explícito al revisar el port de wallet-api):
 *  - contador «n / máx» que controla la escritura, con el máximo salido del schema Zod
 *  - «*» con tooltip «Este campo es obligatorio» y «(Opcional)» en los demás
 *  - error y hint en `p-message`, con el contador siempre presente
 */
describe('DynamicForm · campos (formulario de alta rápida de tickets)', () => {
  let fixture: ComponentFixture<DynamicForm>;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideOptimus({})] });
    fixture = TestBed.createComponent(DynamicForm);
    fixture.componentRef.setInput('$definition', TICKET_QUICK_FORM);
    await fixture.whenStable();
    root = fixture.nativeElement as HTMLElement;
  });

  const fieldHost = (key: string): HTMLElement =>
    [...root.querySelectorAll<HTMLElement>('app-dynamic-field')].find((el) =>
      el.querySelector(`#field-${key}`),
    ) as HTMLElement;

  const footer = (key: string): string =>
    (fieldHost(key).querySelector('app-field-footer')?.textContent ?? '').replace(/\s+/g, ' ').trim();

  async function type(key: string, value: string): Promise<void> {
    const input = fieldHost(key).querySelector<HTMLInputElement>(`#field-${key}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('el título muestra el contador «0 / 120» desde el inicio (máximo = el del schema)', () => {
    expect(footer('title')).toContain('0 / 120');
  });

  it('el contador sigue lo que se escribe', async () => {
    await type('title', 'Falla en el login');
    expect(footer('title')).toContain('17 / 120');
  });

  it('la descripción tiene su propio máximo (2000) y también cuenta', () => {
    expect(footer('description')).toContain('0 / 2000');
  });

  it('un campo sin tope (select) NO muestra contador', () => {
    expect(footer('category')).not.toContain('/');
  });

  it('el control limita la escritura con `maxlength` (lo pone [formField] desde la regla del schema)', () => {
    const title = fieldHost('title').querySelector<HTMLInputElement>('#field-title');
    expect(title?.getAttribute('maxlength')).toBe('120');
    const description = fieldHost('description').querySelector<HTMLTextAreaElement>('#field-description');
    expect(description?.getAttribute('maxlength')).toBe('2000');
  });

  it('un campo obligatorio lleva «*» con tooltip; uno opcional, «(Opcional)»', () => {
    const asterisk = fieldHost('title').querySelector('.fl-required');
    expect(asterisk?.textContent?.trim()).toBe('*');
    // El tooltip de optimus-ui se registra por la directiva `pTooltip` sobre ese mismo elemento.
    expect(asterisk?.hasAttribute('aria-hidden')).toBe(true);
    expect(fieldHost('title').querySelector('.fl .sr-only')?.textContent).toContain('obligatorio');

    expect(fieldHost('description').querySelector('.fl-required')).toBeNull();
    expect(fieldHost('description').querySelector('.fl-optional')?.textContent).toContain('Opcional');
  });

  it('el error aparece como p-message al salir del campo y el contador se mantiene', async () => {
    const input = fieldHost('title').querySelector<HTMLInputElement>('#field-title') as HTMLInputElement;
    await type('title', 'ab');
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(fieldHost('title').querySelector('app-field-footer p-message')).not.toBeNull();
    expect(footer('title')).toContain('2 / 120');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('field-title-error');
  });
});
