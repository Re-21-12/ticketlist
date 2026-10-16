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

/**
 * «Tareas programadas» (administrador): configurar el cierre automático (cron y plazo), validar y
 * ejecutarlo a mano.
 *
 * Se maneja el DOM REAL de los componentes de optimus-ui (el `<input>` del autocomplete, el del
 * inputnumber, el checkbox del interruptor), no los atributos de estado: es la única forma de
 * comprobar que el control real responde y que la congruencia de tamaños no la rompió nadie.
 */
describe('Tareas programadas', () => {
  const WAIT = { timeout: 8000, interval: 100 };
  const JOB = 'ticket-auto-close';

  beforeEach(async () => {
    resetMockBff();
    // jsdom no implementa `matchMedia` y el Overlay de optimus-ui lo consulta al abrir cualquier
    // panel (autocomplete, popover, datepicker). Se define el mínimo que usa: `matches` siempre
    // falso y `addEventListener`/`addListener` como no-ops.
    window.matchMedia ??= ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    // El autocomplete hace `scrollIntoView` sobre la opción activa al abrir el panel; jsdom no lo
    // implementa. No-op: en el navegador real solo scrolls, y aquí no hay nada que ver.
    Element.prototype.scrollIntoView ??= () => undefined;
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

  const field = <T extends HTMLElement>(root: HTMLElement, id: string) =>
    root.querySelector<T>(`#${id}-${JOB}`) as T;
  const write = (el: HTMLInputElement, value: string) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const button = (root: HTMLElement, text: string) =>
    [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  /**
   * El panel del autocomplete vive FUERA del componente de la prueba (`appendTo="body"`), así que
   * `autoDetectChanges` no basta: hay que forzar un ciclo y esperar a que se asiente antes de leerlo.
   */
  const flush = async (fixture: ComponentFixture<Jobs>): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Espera a que el overlay ofrezca una opción que empiece por ese texto y la pulsa, como la persona. */
  async function choosePreset(fixture: ComponentFixture<Jobs>, root: HTMLElement, query: string): Promise<void> {
    const input = field<HTMLInputElement>(root, 'jc-preset');
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const option = await vi.waitFor(
      async () => {
        await flush(fixture);
        const found = [...document.querySelectorAll<HTMLElement>('li')].find((candidate) =>
          candidate.textContent?.trim().startsWith(query),
        );
        if (!found) throw new Error(`El desplegable de la frecuencia no ofrece «${query}».`);
        return found;
      },
      { ...WAIT, interval: 200 },
    );
    option.click();
  }

  it('muestra la tarea con su configuración, la próxima corrida y «Todavía no ha corrido»', async () => {
    const { root } = await render();
    expect(root.textContent).toContain('Cierre automático de tickets resueltos');
    expect(field<HTMLInputElement>(root, 'jc-cron').value).toBe('*/10 * * * *');
    expect(root.querySelector<HTMLInputElement>('.p-inputnumber-input')?.value).toBe('48');
    expect(field<HTMLInputElement>(root, 'jc-preset').value).toBe('Cada 10 minutos');
    expect(root.textContent).toContain('Próxima corrida');
    expect(root.textContent).toContain('Todavía no ha corrido');
    expect(button(root, 'Guardar cambios').disabled).toBe(true); // nada cambió
  });

  it('valida el cron al instante y acota el plazo a 1–720', async () => {
    const { fixture, root } = await render();
    await choosePreset(fixture, root, 'Personalizado');
    write(field<HTMLInputElement>(root, 'jc-cron'), 'cada rato');
    await vi.waitFor(() => expect(root.textContent).toContain('La expresión no es válida'), WAIT);
    expect(button(root, 'Guardar cambios').disabled).toBe(true);

    write(field<HTMLInputElement>(root, 'jc-cron'), '0 8 * * 1-5');
    await vi.waitFor(() => expect(root.textContent).not.toContain('La expresión no es válida'), WAIT);
    expect(button(root, 'Guardar cambios').disabled).toBe(false); // cron válido + plazo válido = guardable

    // El rango del plazo lo impone el `p-inputnumber` (`min`/`max`), igual que hace el formulario
    // dinámico: la persona no puede escribir un plazo que el servidor vaya a rechazar.
    const hours = root.querySelector<HTMLInputElement>('.p-inputnumber-input') as HTMLInputElement;
    expect(hours.getAttribute('min')).toBe('1');
    expect(hours.getAttribute('max')).toBe('720');
  });

  it('cambia la frecuencia y el plazo, guarda, y «Ejecutar ahora» registra la corrida', { timeout: 20000 }, async () => {
    const { fixture, root } = await render();
    await choosePreset(fixture, root, 'Cada hora');
    write(root.querySelector<HTMLInputElement>('.p-inputnumber-input') as HTMLInputElement, '24');
    await vi.waitFor(() => expect(field<HTMLInputElement>(root, 'jc-cron').value).toBe('0 * * * *'), WAIT);
    const save = button(root, 'Guardar cambios');
    await vi.waitFor(() => expect(save.disabled).toBe(false), WAIT);
    save.click();
    await vi.waitFor(() => expect(root.textContent).toContain('marta@ticketit.dev'), WAIT); // «Último cambio de configuración · quién»
    expect(button(root, 'Guardar cambios').disabled).toBe(true);

    button(root, 'Ejecutar ahora').click();
    await vi.waitFor(() => expect(root.querySelector('.jc-notice')?.textContent).toContain('Ningún ticket'), WAIT);
    await vi.waitFor(() => expect(root.textContent).toContain('a mano por marta@ticketit.dev'), WAIT);
  });

  it('desactivarla quita la próxima corrida', async () => {
    const { root } = await render();
    const toggle = field<HTMLInputElement>(root, 'jc-enabled');
    toggle.click();
    await vi.waitFor(() => expect(root.textContent).toContain('Desactivada'), WAIT);
    button(root, 'Guardar cambios').click();
    await vi.waitFor(() => expect(root.textContent).toContain('No programada (desactivada)'), WAIT);
  });

  it('los controles de la tarjeta comparten la clase de altura y el menú de la frecuencia se despliega', async () => {
    const { fixture, root } = await render();
    // jsdom no calcula layouts (`getBoundingClientRect()` es 0), así que se comprueba la REGLA que
    // da la altura en vez del pixel: los tres campos editables llevan `jc-input`, que es
    // `height: var(--app-control-height)`. Con el input nativo y el `<select>` a 44 px contra un
    // `pButton size="small"` de 35 px, los bordes de la fila no emparejaban.
    const cron = field<HTMLInputElement>(root, 'jc-cron');
    const preset = field<HTMLInputElement>(root, 'jc-preset');
    const hours = root.querySelector<HTMLInputElement>('.p-inputnumber-input') as HTMLInputElement;
    for (const input of [cron, preset, hours]) expect(input.classList).toContain('jc-input');

    write(preset, 'Cada');
    const options = await vi.waitFor(
      async () => {
        await flush(fixture);
        const found = [...document.querySelectorAll('li')].filter((li) => li.textContent?.startsWith('Cada'))
          .length;
        if (found === 0) throw new Error('El desplegable de la frecuencia sigue vacío.');
        return found;
      },
      { ...WAIT, interval: 300 },
    );
    expect(options).toBe(4); // cada 10 min · cada 30 min · cada hora · cada 6 horas
  });
});