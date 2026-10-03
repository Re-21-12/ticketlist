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
import { mockRealtime$, mockRealtimeState } from '../../core/mock-bff/mock-realtime';
import { NotificationStreamService } from '../../core/realtime/notification-stream.service';
import { SessionStore } from '../../core/session/session.store';
import { MyTickets } from './my-tickets';

/**
 * CU01 en pantalla: A1 (sin tickets: mensaje + crear), el detalle con su historial (incluido el aviso enviado) y A2
 * (sin conexión en vivo: alerta de sincronización y actualización manual).
 */
describe('Mis tickets (CU01)', () => {
  const WAIT = { timeout: 8000, interval: 100 };
  let store: SessionStore;
  let stream: NotificationStreamService;

  beforeEach(() => {
    resetMockBff();
    mockRealtimeState.offline = false;
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
  });

  afterEach(() => {
    stream.disconnect();
    mockRealtimeState.offline = false;
  });

  async function render(): Promise<{ fixture: ComponentFixture<MyTickets>; root: HTMLElement }> {
    const fixture = TestBed.createComponent(MyTickets);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('A1: sin tickets dice que no hay solicitudes activas y ofrece crear uno', async () => {
    await store.signInAs(EUserRole.VIEWER);
    stream.connect();
    const { root } = await render();
    await vi.waitFor(() => expect(root.textContent).toContain('No tienes solicitudes activas'), WAIT);
    const create = [...root.querySelectorAll('a')].find((a) => a.textContent?.includes('Crear un ticket'));
    expect(create?.getAttribute('href')).toBe('/tickets/new');
    expect(root.querySelector('.mt-alert')).toBeNull(); // en vivo: sin alerta de sincronización
  });

  it('lista lo que registró la persona y, al elegirlo, muestra su historial con los avisos enviados', async () => {
    await store.signInAs(EUserRole.VIEWER);
    stream.connect();
    const http = TestBed.inject(HttpClient);
    const created = await firstValueFrom(
      http.post<{ uuid: string; code: string }>('/api/tickets', { title: 'No abre el portal', description: '', department: 'it', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true }),
    );
    const { fixture, root } = await render();
    fixture.componentRef.setInput('ticket', created.uuid);
    await vi.waitFor(() => expect(root.querySelectorAll('.mt-item').length).toBe(1), WAIT);
    expect(root.textContent).toContain(created.code);
    await vi.waitFor(() => expect(root.querySelector('.mt-timeline')).not.toBeNull(), WAIT);
    expect(root.textContent).toContain('Historial de interacciones');
    expect(root.textContent).toContain('Ticket registrado');
    // Tiene la caja para comentar (el ticket está abierto).
    expect(root.querySelector('#mt-comment')).not.toBeNull();
  });

  it('A2: sin conexión en vivo muestra la alerta de sincronización y permite actualizar a mano', async () => {
    await store.signInAs(EUserRole.VIEWER);
    mockRealtimeState.offline = true;
    stream.connect();
    const { root } = await render();
    await vi.waitFor(() => expect(root.querySelector('.mt-alert')).not.toBeNull(), WAIT);
    expect(root.querySelector('.mt-alert')?.textContent).toContain('No se pudo sincronizar en tiempo real');
    expect(root.querySelector('.mt-toolbar')?.textContent).toContain('Sin conexión en vivo');
    const manual = [...root.querySelectorAll('button')].filter((b) => b.textContent?.includes('Actualizar'));
    expect(manual.length).toBeGreaterThanOrEqual(2); // «Actualizar» de la barra y «Actualizar ahora» de la alerta
    // «Actualizar ahora» reintenta el canal: ya con conexión, la alerta desaparece.
    mockRealtimeState.offline = false;
    [...root.querySelectorAll('button')].find((b) => b.textContent?.includes('Actualizar ahora'))?.click();
    await vi.waitFor(() => expect(root.querySelector('.mt-alert')).toBeNull(), WAIT);
  });

  it('un aviso en tiempo real sobre un ticket vuelve a pedir la lista (el estado se actualiza solo)', async () => {
    await store.signInAs(EUserRole.VIEWER);
    stream.connect();
    const { root } = await render();
    await vi.waitFor(() => expect(root.textContent).toContain('No tienes solicitudes activas'), WAIT);
    // Mientras tanto aparece un ticket suyo (otro dispositivo) y llega el aviso por el stream.
    const http = TestBed.inject(HttpClient);
    await firstValueFrom(
      http.post('/api/tickets', { title: 'Nuevo desde el celular', description: '', department: 'it', type: 'inquiry', category: 'other', otherCategoryDetail: 'x', priority: 'low', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true }),
    );
    mockRealtime$.next({
      recipientUuid: store.$user()!.uuid,
      notification: { uuid: crypto.randomUUID(), type: 'TICKET_STATUS_CHANGED', message: 'TCK-004 está en atención', resourceType: 'Ticket', resourceUuid: crypto.randomUUID(), readAt: null, createdAt: new Date().toISOString() },
    });
    await vi.waitFor(() => expect(root.querySelectorAll('.mt-item').length).toBe(1), WAIT);
  });
});
