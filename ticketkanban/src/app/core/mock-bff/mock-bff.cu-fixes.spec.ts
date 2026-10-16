import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

const DRAFT = { title: 'No abre el portal', description: '', department: 'it', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };

/**
 * Correcciones tras la auditoría del documento (mismas reglas que el backend): bloqueo de 15 min con desbloqueo manual,
 * mensaje de credenciales del RF-07, nota de asignación, motivo obligatorio al reabrir y el catálogo de estados.
 */
describe('mock BFF · correcciones de la auditoría', () => {
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

  afterEach(() => vi.useRealTimers());

  const signIn = (password: string) => store.signIn({ email: 'ana@ticketit.dev', password }).catch((error: unknown) => readProblem(error));
  const codeOf = async (promise: Promise<unknown>) => readProblem(await promise.catch((e: unknown) => e))?.code;

  it('RF-07: credenciales incorrectas dicen «Correo electrónico o contraseña incorrectos»', async () => {
    const problem = await signIn('mala');
    expect(problem).toMatchObject({ code: 'SAUT-E004', title: 'Correo electrónico o contraseña incorrectos' });
  });

  it('RNF-07: 5 fallos bloquean; se desbloquea SOLA a los 15 min (avisa cuándo) y un administrador puede antes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let i = 0; i < 4; i++) expect((await signIn('mala'))?.code).toBe('SAUT-E004');
    const locked = await signIn('mala');
    expect(locked?.code).toBe('SAUT-E014');
    const unlocksAt = new Date(String(locked?.context?.['unlocksAt'])).getTime();
    expect(unlocksAt - Date.now()).toBe(15 * 60_000);

    vi.setSystemTime(Date.now() + 14 * 60_000);
    expect((await signIn('ticketit-dev'))?.code).toBe('SAUT-E014'); // a los 14 min sigue bloqueada

    vi.setSystemTime(Date.now() + 2 * 60_000); // 16 min en total
    expect(await signIn('ticketit-dev')).toBeUndefined(); // entró
    expect(store.$user()?.email).toBe('ana@ticketit.dev');
  });

  it('RNF-07: el desbloqueo manual del administrador sigue disponible dentro de los 15 min', async () => {
    for (let i = 0; i < 5; i++) await signIn('mala');
    expect((await signIn('ticketit-dev'))?.code).toBe('SAUT-E014');
    await store.signInAs(EUserRole.ADMIN);
    const users = await firstValueFrom(http.get<{ data: { uuid: string; email: string; disabled: boolean; locked: boolean }[] }>('/api/users'));
    const ana = users.data.find((u) => u.email === 'ana@ticketit.dev')!;
    expect(ana.locked).toBe(true);
    await firstValueFrom(http.patch(`/api/users/${ana.uuid}/status`, { disabled: false, locked: false }));
    await store.signOut();
    expect(await signIn('ticketit-dev')).toBeUndefined();
  });

  it('nota de asignación: queda en el historial y en el aviso al responsable (no es un campo del ticket)', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', DRAFT));
    await store.signInAs(EUserRole.SUPERVISOR);
    const ticket = await firstValueFrom(http.get<Record<string, unknown>>(`/api/tickets/${uuid}`));
    const updated = await firstValueFrom(http.patch<Record<string, unknown>>(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null, assignmentNote: 'Empieza por revisar el VPN.' }));
    expect(updated).not.toHaveProperty('assignmentNote');
    const events = await firstValueFrom(http.get<{ data: { type: string; body: string | null }[] }>(`/api/tickets/${uuid}/events`));
    expect(events.data.find((e) => e.type === 'ASSIGNED')?.body).toBe('Empieza por revisar el VPN.');
    await store.signInAs(EUserRole.AGENT);
    const notices = await firstValueFrom(http.get<{ data: { type: string; message: string }[] }>('/api/notifications'));
    expect(notices.data.some((n) => n.type === 'TICKET_ASSIGNED' && n.message.includes('Nota: Empieza por revisar el VPN.'))).toBe(true);
  });

  it('un cliente no asigna: su nota de asignación se descarta', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', { ...DRAFT, assigneeEmail: 'ana@ticketit.dev', assignmentNote: 'x' }));
    const events = await firstValueFrom(http.get<{ data: { type: string }[] }>(`/api/tickets/${uuid}/events`));
    expect(events.data.some((e) => e.type === 'ASSIGNED')).toBe(false);
  });

  it('reabrir exige el motivo: sin él 400 y el ticket sigue «Resuelto»', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const { uuid } = await firstValueFrom(http.post<{ uuid: string }>('/api/tickets', DRAFT));
    await store.signInAs(EUserRole.SUPERVISOR);
    const ticket = await firstValueFrom(http.get<Record<string, unknown>>(`/api/tickets/${uuid}`));
    await firstValueFrom(http.patch(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null }));
    await store.signInAs(EUserRole.AGENT);
    await firstValueFrom(http.post(`/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Listo.' }));
    await store.signInAs(EUserRole.VIEWER);
    expect(await codeOf(firstValueFrom(http.post(`/api/tickets/${uuid}/transitions`, { to: 'reopened' })))).toBe('CVAL-E001');
    expect(await codeOf(firstValueFrom(http.post(`/api/tickets/${uuid}/transitions`, { to: 'reopened', note: 'no' })))).toBe('CVAL-E001');
    const reopened = await firstValueFrom(http.post<{ status: string }>(`/api/tickets/${uuid}/transitions`, { to: 'reopened', note: 'Sigue sin abrir.' }));
    expect(reopened.status).toBe('reopened');
  });

  it('el catálogo de estados usa los nombres del documento: «Abierto» y «En progreso»', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const detail = await firstValueFrom(http.get<{ items: { code: string; label: string }[] }>('/api/catalogs/ticket-status'));
    const label = (code: string) => detail.items.find((item) => item.code === code)?.label;
    expect(label('new')).toBe('Abierto');
    expect(label('in_progress')).toBe('En progreso');
    expect(label('resolved')).toBe('Resuelto');
  });
});
