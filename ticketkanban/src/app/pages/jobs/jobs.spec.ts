import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { EUserRole } from '../../core/casl/ability.enum';
import { AppAbility } from '../../core/casl/casl.types';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { resetMockBff } from '../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../core/mock-bff/mock-bff.interceptor';
import { SessionStore } from '../../core/session/session.store';
import { Jobs } from './jobs';

/** «Tareas programadas» (administrador): configurar el cierre automático (cron y plazo), validar y ejecutarlo a mano. */
describe('Tareas programadas', () => {
  const WAIT = { timeout: 8000, interval: 100 };

  beforeEach(async () => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        provideOptimus({}),
        MessageService,
        ConfirmationService,
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    await TestBed.inject(SessionStore).signInAs(EUserRole.ADMIN);
  });

  async function render(): Promise<{ fixture: ComponentFixture<Jobs>; root: HTMLElement }> {
    const fixture = TestBed.createComponent(Jobs);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(root.querySelector('.jc')).not.toBeNull(), WAIT);
    return { fixture, root };
  }

  const field = <T extends HTMLElement>(root: HTMLElement, id: string) => root.querySelector<T>(`#${id}-ticket-auto-close`) as T;
  const type = (el: HTMLInputElement | HTMLSelectElement, value: string, event: 'input' | 'change' = 'input') => {
    el.value = value;
    el.dispatchEvent(new Event(event, { bubbles: true }));
  };
  const button = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  it('muestra la tarea con su configuración, la próxima corrida y «Todavía no ha corrido»', async () => {
    const { root } = await render();
    expect(root.textContent).toContain('Cierre automático de tickets resueltos');
    expect(field<HTMLInputElement>(root, 'jc-cron').value).toBe('*/10 * * * *');
    expect(field<HTMLInputElement>(root, 'jc-hours').value).toBe('48');
    expect(root.textContent).toContain('Próxima corrida');
    expect(root.textContent).toContain('Todavía no ha corrido');
    expect(button(root, 'Guardar cambios').disabled).toBe(true); // nada cambió
  });

  it('valida el cron y el plazo al instante: con un valor inválido no se puede guardar', async () => {
    const { fixture, root } = await render();
    type(field<HTMLSelectElement>(root, 'jc-preset'), 'custom', 'change');
    fixture.detectChanges();
    type(field<HTMLInputElement>(root, 'jc-cron'), 'cada rato');
    fixture.detectChanges();
    expect(root.textContent).toContain('La expresión no es válida');
    expect(button(root, 'Guardar cambios').disabled).toBe(true);
    type(field<HTMLInputElement>(root, 'jc-cron'), '0 8 * * 1-5');
    type(field<HTMLInputElement>(root, 'jc-hours'), '0');
    fixture.detectChanges();
    expect(root.textContent).toContain('número entero de horas entre 1 y 720');
    expect(button(root, 'Guardar cambios').disabled).toBe(true);
  });

  it('cambia la frecuencia y el plazo, guarda, y «Ejecutar ahora» registra la corrida', async () => {
    const { fixture, root } = await render();
    type(field<HTMLSelectElement>(root, 'jc-preset'), 'hourly', 'change');
    type(field<HTMLInputElement>(root, 'jc-hours'), '24');
    fixture.detectChanges();
    expect(field<HTMLInputElement>(root, 'jc-cron').value).toBe('0 * * * *');
    const save = button(root, 'Guardar cambios');
    expect(save.disabled).toBe(false);
    save.click();
    await vi.waitFor(() => expect(root.textContent).toContain('marta@ticketit.dev'), WAIT); // «Último cambio de configuración · quién»
    expect(button(root, 'Guardar cambios').disabled).toBe(true);

    button(root, 'Ejecutar ahora').click();
    await vi.waitFor(() => expect(root.querySelector('.jc-notice')?.textContent).toContain('Ningún ticket'), WAIT);
    await vi.waitFor(() => expect(root.textContent).toContain('a mano por marta@ticketit.dev'), WAIT);
  });

  it('desactivarla quita la próxima corrida', async () => {
    const { fixture, root } = await render();
    const toggle = root.querySelector<HTMLInputElement>('.jc-switch-input') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(root.textContent).toContain('Desactivada');
    button(root, 'Guardar cambios').click();
    await vi.waitFor(() => expect(root.textContent).toContain('No programada (desactivada)'), WAIT);
  });
});
