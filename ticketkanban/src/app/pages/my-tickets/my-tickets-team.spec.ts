import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { createMongoAbility } from '@casl/ability';
import { ConfirmationService, MessageService } from '@openng/optimus-ui/api';
import { provideOptimus } from '@openng/optimus-ui/config';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../../core/casl/ability.enum';
import { AppAbility } from '../../core/casl/casl.types';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { resetMockBff } from '../../core/mock-bff/mock-bff.handler';
import { mockBffInterceptor } from '../../core/mock-bff/mock-bff.interceptor';
import { NotificationStreamService } from '../../core/realtime/notification-stream.service';
import { SessionStore } from '../../core/session/session.store';
import { MyTickets } from './my-tickets';

/**
 * El HILO del equipo de soporte: el agente ve «Asignados a mí» (y «Todos»), lee el historial completo con las notas internas,
 * responde a la persona o deja una nota interna y cambia el estado. El cliente sigue viendo «Mis tickets» sin nada de eso.
 */
describe('Hilo de tickets (equipo de soporte)', () => {
  const WAIT = { timeout: 10_000, interval: 100 };
  let store: SessionStore;
  let stream: NotificationStreamService;
  let http: HttpClient;

  beforeEach(() => {
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
    store = TestBed.inject(SessionStore);
    stream = TestBed.inject(NotificationStreamService);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => stream.disconnect());

  const draft = { title: 'No abre el portal', description: '', department: 'it', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };

  /** Víctor registra un ticket y el supervisor lo asigna a Ana. Devuelve su uuid. */
  async function ticketAssignedToAna(): Promise<string> {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', draft));
    await store.signInAs(EUserRole.SUPERVISOR);
    const ticket = await firstValueFrom(http.get<Record<string, unknown>>(`/api/tickets/${uuid}`));
    await firstValueFrom(http.patch(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null }));
    return uuid;
  }

  async function open(ticket?: string): Promise<{ fixture: ComponentFixture<MyTickets>; root: HTMLElement }> {
    stream.connect();
    const fixture = TestBed.createComponent(MyTickets);
    if (ticket) fixture.componentRef.setInput('ticket', ticket);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  const button = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  it('el agente entra al hilo con «Asignados a mí» y ve el ticket que le asignaron', async () => {
    const uuid = await ticketAssignedToAna();
    await store.signInAs(EUserRole.AGENT);
    const { root } = await open(uuid);
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')).not.toBeNull(), WAIT);
    expect(root.querySelector('.mt-title')?.textContent).toContain('Hilo de tickets');
    const scopes = [...root.querySelectorAll('.mt-scope')].map((el) => el.textContent?.trim());
    expect(scopes).toEqual(['Registrados por mí', 'Asignados a mí', 'Todos']);
    expect(root.querySelector('.mt-scope--active')?.textContent).toContain('Asignados a mí');
    expect(root.querySelector('.mt-list')?.textContent).toContain('No abre el portal');
    expect(root.querySelector('.mt-facts')?.textContent).toContain('Solicita');
  }, 90_000);

  it('el agente puede dejar una nota interna (solo el equipo la ve) y cambiar el estado', async () => {
    const uuid = await ticketAssignedToAna();
    await store.signInAs(EUserRole.AGENT);
    const { fixture, root } = await open(uuid);
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')).not.toBeNull(), WAIT);

    expect(root.textContent).toContain('Cambiar el estado');
    expect(button(root, 'En progreso')).toBeDefined();

    const box = root.querySelector<HTMLInputElement>('.mt-internal input') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    const comment = root.querySelector<HTMLTextAreaElement>('#mt-comment') as HTMLTextAreaElement;
    comment.value = 'Parece un tema de permisos en el AD.';
    comment.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(button(root, 'Guardar nota interna')).toBeDefined();
    button(root, 'Guardar nota interna')?.click();
    await vi.waitFor(() => expect(root.querySelector('.mt-event--internal')?.textContent).toContain('Parece un tema de permisos'), WAIT);
    expect(root.querySelector('.mt-event--internal')?.textContent).toContain('Nota interna del equipo');

    button(root, 'En progreso')?.click();
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')?.textContent).toContain('En progreso'), WAIT);
  }, 90_000);

  it('el cliente sigue viendo «Mis tickets»: sin alcances, sin notas internas y sin cambiar el estado', async () => {
    const uuid = await ticketAssignedToAna();
    await store.signInAs(EUserRole.VIEWER);
    const { root } = await open(uuid);
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')).not.toBeNull(), WAIT);
    expect(root.querySelector('.mt-title')?.textContent).toContain('Mis tickets');
    expect(root.querySelector('.mt-scopes')).toBeNull();
    expect(root.querySelector('.mt-internal')).toBeNull();
    expect(root.textContent).not.toContain('Cambiar el estado');
  }, 90_000);
});
