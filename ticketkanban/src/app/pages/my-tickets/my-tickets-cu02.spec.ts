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
 * CU02 en pantalla: historial inmutable (A1), evidencia en el comentario, y —con el ticket «Resuelto»— el resumen de la
 * solución con «Confirmar cierre» y «Reabrir ticket» (A3).
 */
describe('Mis tickets (CU02)', () => {
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

  /** Víctor registra un ticket, el supervisor lo asigna a Ana y Ana lo resuelve; vuelve a entrar Víctor. */
  async function resolvedTicketOfVictor(): Promise<string> {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', draft));
    await store.signInAs(EUserRole.SUPERVISOR);
    const ticket = await firstValueFrom(http.get<Record<string, unknown>>(`/api/tickets/${uuid}`));
    await firstValueFrom(http.patch(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null }));
    await store.signInAs(EUserRole.AGENT);
    await firstValueFrom(http.post(`/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Se reinició el portal.' }));
    await store.signInAs(EUserRole.VIEWER);
    return uuid;
  }

  async function open(uuid: string): Promise<{ fixture: ComponentFixture<MyTickets>; root: HTMLElement }> {
    stream.connect();
    const fixture = TestBed.createComponent(MyTickets);
    fixture.componentRef.setInput('ticket', uuid);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')).not.toBeNull(), WAIT);
    return { fixture, root };
  }

  const button = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

  it('«Resuelto»: muestra la solución y las opciones «Confirmar cierre» y «Reabrir ticket»', async () => {
    const uuid = await resolvedTicketOfVictor();
    const { root } = await open(uuid);
    expect(root.querySelector('.mt-confirm')?.textContent).toContain('¿Quedó resuelto tu problema?');
    expect(root.textContent).toContain('Se reinició el portal.');
    expect(button(root, 'Confirmar cierre')).toBeDefined();
    expect(button(root, 'Reabrir ticket')).toBeDefined();
    expect(root.querySelector('.mt-confirm')?.textContent).toContain('48 horas');
  }, 90_000);

  it('A3: «Reabrir ticket» lo pasa a «Reabierto», queda en el historial y deja de pedir confirmación', async () => {
    const uuid = await resolvedTicketOfVictor();
    const { root } = await open(uuid);
    button(root, 'Reabrir ticket')?.click();
    await vi.waitFor(() => expect(root.querySelector('.mt-confirm')).toBeNull(), WAIT);
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')?.textContent).toContain('Reabierto'), WAIT);
  }, 90_000);

  it('«Confirmar cierre» lo pasa a «Cerrado»: ya no admite comentarios', async () => {
    const uuid = await resolvedTicketOfVictor();
    const { root } = await open(uuid);
    button(root, 'Confirmar cierre')?.click();
    await vi.waitFor(() => expect(root.textContent).toContain('Este ticket está cerrado: ya no admite comentarios'), WAIT);
    expect(root.querySelector('.mt-confirm')).toBeNull();
    expect(root.querySelector('#mt-comment')).toBeNull();
    // Ya cerrado, se abre la encuesta (¿se resolvió?, calificación, comentario opcional): se espera a que aparezca para no
    // dejar la apertura del modal a medias cuando termina la prueba.
    await vi.waitFor(() => expect(document.body.textContent).toContain('¿Se resolvió tu problema?'), WAIT);
    expect(document.body.textContent).toContain('Sí, se resolvió');
  }, 90_000);

  it('A1: el historial dice que no se modifica y «Editar» sobre un comentario propio muestra el rechazo', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', draft));
    await firstValueFrom(http.post(`/api/tickets/${uuid}/comments`, { body: 'Sigue sin abrir', internal: false, attachmentIds: [] }));
    const { fixture, root } = await open(uuid);
    expect(root.querySelector('.mt-immutable')?.textContent).toContain('Los comentarios previos no pueden modificarse');
    await vi.waitFor(() => expect(root.querySelector('.mt-edit')).not.toBeNull(), WAIT);
    (root.querySelector('.mt-edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(root.querySelector('.mt-edit-notice')?.textContent).toContain('Los comentarios previos no pueden modificarse'), WAIT);
  }, 60_000);

  it('el comentario trae el selector de evidencia (imágenes, PDF, Excel, CSV y videos cortos)', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', draft));
    const { root } = await open(uuid);
    expect(root.querySelector('app-evidence-uploader')?.textContent).toContain('Imágenes, PDF, Excel, CSV');
    expect(root.querySelector('input[type=file]')?.getAttribute('accept')).toContain('.csv');
  }, 60_000);
});
