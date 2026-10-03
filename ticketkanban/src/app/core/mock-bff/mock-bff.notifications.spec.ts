import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { MyTicketListSchema, TicketEventListSchema } from '../../pages/my-tickets/my-tickets.schema';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';
import { mockRealtime$, type IMockRealtimeEvent } from './mock-realtime';

const TCK_001 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01'; // en atención, de Ana (agente), asignado a Ana

/**
 * CU01 en el mock (mismas reglas que `ticket-notifications.e2e-spec.ts` del backend): «Mis tickets» con `mine=true`, aviso
 * al solicitante en cada cambio de estado, tiempo real y constancia del aviso en el historial del ticket.
 */
describe('mock BFF · CU01 notificaciones por ticket', () => {
  let store: SessionStore;
  let http: HttpClient;

  beforeEach(() => {
    resetMockBff();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, mockBffInterceptor])),
        { provide: MessageService, useValue: { add: vi.fn() } },
        { provide: AppAbility, useValue: createMongoAbility() },
      ],
    });
    store = TestBed.inject(SessionStore);
    http = TestBed.inject(HttpClient);
  });

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));
  const post = <T>(url: string, body: object = {}) => firstValueFrom(http.post<T>(url, body));
  const codeOf = async (promise: Promise<unknown>) => readProblem(await promise.catch((e: unknown) => e))?.code;
  const draft = { title: 'No abre el portal', description: '', department: 'it', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };

  async function victorCreatesATicket(): Promise<string> {
    await store.signInAs(EUserRole.VIEWER);
    return (await post<{ uuid: string }>('/api/tickets', draft)).uuid;
  }

  it('«Mis tickets»: mine=true devuelve solo los que registró quien consulta', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const all = MyTicketListSchema.parse(await get('/api/tickets?take=50'));
    const mine = MyTicketListSchema.parse(await get('/api/tickets?take=50&mine=true'));
    expect(all.data.length).toBeGreaterThan(mine.data.length);
    expect(new Set(mine.data.map((t) => t.ownerUuid)).size).toBeLessThanOrEqual(1);
  });

  it('A1: una cuenta sin tickets recibe la lista vacía', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const mine = MyTicketListSchema.parse(await get('/api/tickets?mine=true'));
    expect(mine.data).toEqual([]);
    expect(mine.meta.total).toBe(0);
  });

  it('el historial arranca con «Ticket registrado» y los tickets de siempre traen el suyo', async () => {
    const uuid = await victorCreatesATicket();
    const created = TicketEventListSchema.parse(await get(`/api/tickets/${uuid}/events`));
    expect(created.data.map((e) => e.type)).toEqual(['CREATED']);
    await store.signInAs(EUserRole.ADMIN);
    const seeded = TicketEventListSchema.parse(await get(`/api/tickets/${TCK_001}/events`));
    expect(seeded.data[0]?.type).toBe('CREATED');
    expect(seeded.data.map((e) => e.type)).toContain('ASSIGNED');
  });

  it('un cambio de estado del equipo avisa al solicitante, lo publica en tiempo real y queda en el historial (NOTIFIED)', async () => {
    const uuid = await victorCreatesATicket();
    // El supervisor asigna: el solicitante recibe «atenderá tu solicitud».
    await store.signInAs(EUserRole.SUPERVISOR);
    const received: IMockRealtimeEvent[] = [];
    const sub = mockRealtime$.subscribe((event) => received.push(event));
    const ticket = await get<Record<string, unknown>>(`/api/tickets/${uuid}`);
    await firstValueFrom(http.patch(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null }));
    // El agente lo pone en atención.
    await store.signInAs(EUserRole.AGENT);
    await post(`/api/tickets/${uuid}/transitions`, { to: 'in_progress' });
    sub.unsubscribe();

    expect(received.map((e) => (e.notification as { message: string }).message)).toEqual(
      expect.arrayContaining([expect.stringContaining('atenderá tu solicitud'), expect.stringContaining('está en atención')]),
    );

    // Víctor ve el aviso en SU bandeja y el rastro en el historial.
    await store.signInAs(EUserRole.VIEWER);
    const inbox = await get<{ data: { type: string; message: string }[]; unread: number }>('/api/notifications');
    expect(inbox.data.some((n) => n.type === 'TICKET_STATUS_CHANGED' && n.message.includes('está en atención'))).toBe(true);
    const history = TicketEventListSchema.parse(await get(`/api/tickets/${uuid}/events`));
    const notified = history.data.filter((e) => e.type === 'NOTIFIED');
    expect(notified.map((e) => e.body)).toEqual(expect.arrayContaining([expect.stringContaining('atenderá'), expect.stringContaining('está en atención')]));
    expect(notified.every((e) => e.actorName === 'Sistema')).toBe(true);
    // El mock simula 500 ms de latencia por petición y este flujo hace una decena: más tiempo que el de siempre.
  }, 30_000);

  it('la bandeja de cada cuenta es solo suya (los avisos no se filtran a otra sesión)', async () => {
    const uuid = await victorCreatesATicket();
    await store.signInAs(EUserRole.AGENT);
    await post(`/api/tickets/${uuid}/transitions`, { to: 'pending_customer' }).catch(() => undefined);
    await store.signInAs(EUserRole.AUDITOR);
    const inbox = await get<{ data: { message: string }[] }>('/api/notifications');
    expect(inbox.data.some((n) => n.message.includes('necesitamos más información'))).toBe(false);
  });

  it('el solicitante comenta; el equipo recibe el aviso; un ticket cerrado ya no admite comentarios', async () => {
    const uuid = await victorCreatesATicket();
    const written = await post<{ type: string; body: string }>(`/api/tickets/${uuid}/comments`, { body: 'Sigue sin abrir', internal: false, attachmentIds: [] });
    expect(written).toMatchObject({ type: 'COMMENT_PUBLIC', body: 'Sigue sin abrir' });
    expect(await codeOf(post(`/api/tickets/${uuid}/comments`, { body: '   ', internal: false, attachmentIds: [] }))).toBe('CVAL-E001');
    expect(await codeOf(post(`/api/tickets/${uuid}/comments`, { body: 'nota', internal: true, attachmentIds: [] }))).toBe('SAUT-E001');
    // TCK-003 (de Luis) está cerrado: el administrador no puede comentarlo.
    await store.signInAs(EUserRole.ADMIN);
    expect(await codeOf(post('/api/tickets/6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e03/comments', { body: 'tarde', internal: false, attachmentIds: [] }))).toBe('STCK-E003');
  });
});
