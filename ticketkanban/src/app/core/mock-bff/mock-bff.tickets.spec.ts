import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility, subject } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

interface ITicketRow {
  uuid: string;
  code: string;
  status: string;
  type: string;
  complexity: string | null;
  attendedSince: string | null;
  assigneeEmail: string;
  nextStatuses: string[];
}
interface IBoard {
  columns: { group: string; label: string; statuses: string[]; tickets: ITicketRow[] }[];
}

const TCK_001 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01'; // en atención, de Ana, asignado a Ana
const TCK_002 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02'; // nuevo, de Marta, sin asignar

/**
 * Permisos de tickets en el mock (mismas reglas que `ticket-permissions.e2e-spec.ts` del backend): el cliente
 * crea y edita lo suyo pero no elimina ni asigna; el soporte atiende y pide información; el supervisor asigna,
 * escala y pide información pero no resuelve; solo el administrador elimina; el auditor solo lee.
 */
describe('mock BFF · tickets por rol', () => {
  let store: SessionStore;
  let ability: AppAbility;
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
    ability = TestBed.inject(AppAbility);
    http = TestBed.inject(HttpClient);
  });

  const get = <T>(url: string) => firstValueFrom(http.get<T>(url));
  const send = (method: 'post' | 'patch' | 'delete', url: string, body?: object) =>
    firstValueFrom(method === 'delete' ? http.delete(url) : http[method](url, body ?? {}));
  const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
    readProblem(await promise.catch((e: unknown) => e))?.code;
  const ticket = async (uuid: string) => get<ITicketRow>(`/api/tickets/${uuid}`);
  const full = (row: ITicketRow & Record<string, unknown>) => ({
    title: row['title'],
    description: row['description'],
    department: row['department'],
    type: row.type,
    category: row['category'],
    priority: row['priority'],
    complexity: row.complexity,
    assigneeEmail: row.assigneeEmail,
    estimateHours: row['estimateHours'],
    dueDate: row['dueDate'],
    notifyReporter: row['notifyReporter'],
  });

  it('el tablero son TRES columnas (grupos) y la tarjeta trae su estado exacto, tipo y reloj', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const board = await get<IBoard>('/api/bff/board');
    expect(board.columns.map((column) => column.group)).toEqual(['new', 'in_attention', 'closed']);
    expect(board.columns[1].statuses).toEqual(['assigned', 'in_progress', 'escalated', 'pending_customer']);
    const enAtencion = board.columns[1].tickets.find((t) => t.uuid === TCK_001)!;
    expect(enAtencion.status).toBe('in_progress');
    expect(enAtencion.type).toBe('incident');
    expect(enAtencion.attendedSince).not.toBeNull(); // el reloj de la tarjeta
    expect(board.columns[0].tickets.every((t) => t.attendedSince === null)).toBe(true);
  });

  it('el cliente ve solo lo suyo, crea y edita, pero no elimina ni asigna ni fija complejidad', async () => {
    await store.signInAs(EUserRole.VIEWER);
    expect(ability.can('create', 'Ticket')).toBe(true);
    expect(ability.can('delete', subject('Ticket', { ownerUuid: store.$user()!.uuid }))).toBe(false);
    expect(ability.can('create', 'Relationship')).toBe(false); // no maneja los accesos
    expect((await get<{ meta: { total: number } }>('/api/tickets')).meta.total).toBe(0);

    const created = await send('post', '/api/tickets', {
      title: 'Mi laptop no enciende',
      description: '',
      type: 'incident',
      category: 'hardware',
      priority: 'high',
      complexity: 'complex',
      assigneeEmail: 'ana@ticketit.dev',
      estimateHours: 5,
    });
    const row = created as ITicketRow & Record<string, unknown>;
    expect(row.assigneeEmail).toBe(''); // asignar es del equipo
    expect(row.complexity).toBeNull();
    expect(row.status).toBe('new');
    expect(row['estimateHours']).toBeNull();

    const edited = (await send('patch', `/api/tickets/${row.uuid}`, {
      ...full(row),
      title: 'Mi laptop no enciende (actualizado)',
      complexity: 'simple',
      assigneeEmail: 'ana@ticketit.dev',
    })) as ITicketRow & Record<string, unknown>;
    expect(edited['title']).toContain('actualizado');
    expect(edited.complexity).toBeNull(); // se conserva
    expect(edited.assigneeEmail).toBe('');

    expect(await codeOf(send('delete', `/api/tickets/${row.uuid}`))).toBe('SAUT-E001');
  });

  it('solo el administrador elimina', async () => {
    await store.signInAs(EUserRole.AGENT);
    expect(await codeOf(send('delete', `/api/tickets/${TCK_001}`))).toBe('SAUT-E001');
    await store.signInAs(EUserRole.SUPERVISOR);
    expect(await codeOf(send('delete', `/api/tickets/${TCK_001}`))).toBe('SAUT-E001');
    await store.signInAs(EUserRole.ADMIN);
    expect(ability.can('delete', 'Ticket')).toBe(true);
    await send('delete', `/api/tickets/${TCK_001}`);
  });

  it('soporte pasa a «Pendiente del cliente» lo asignado; el supervisor también, pero no resuelve ni atiende', async () => {
    await store.signInAs(EUserRole.AGENT); // Ana: TCK-001 es suyo
    const mine = await ticket(TCK_001);
    expect(mine.nextStatuses).toEqual(expect.arrayContaining(['pending_customer', 'resolved']));
    expect(mine.nextStatuses).not.toContain('escalated'); // escalar es del supervisor
    expect(await codeOf(send('post', `/api/tickets/${TCK_002}/transitions`, { to: 'in_progress' }))).toBe('SAUT-E001'); // lo ve, pero no es suyo
  });

  it('el supervisor asigna, escala y pide información; no resuelve', async () => {
    await store.signInAs(EUserRole.SUPERVISOR);
    const open = await ticket(TCK_001);
    expect(open.nextStatuses).toEqual(expect.arrayContaining(['pending_customer', 'escalated']));
    expect(open.nextStatuses).not.toContain('resolved');
    expect(await codeOf(send('post', `/api/tickets/${TCK_001}/transitions`, { to: 'resolved', resolution: 'Lo arreglé yo' }))).toBe('STCK-E001');
    const escalated = (await send('post', `/api/tickets/${TCK_001}/transitions`, { to: 'escalated' })) as ITicketRow;
    expect(escalated.status).toBe('escalated');
    expect(escalated.attendedSince).toBeNull(); // el reloj de atención se detiene
  });

  it('el reloj arranca al entrar a «En atención»', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const assigned = (await send('post', `/api/tickets/${TCK_002}/transitions`, { to: 'assigned' })) as ITicketRow;
    expect(assigned.attendedSince).not.toBeNull();
    const started = (await send('post', `/api/tickets/${TCK_002}/transitions`, { to: 'in_progress' })) as ITicketRow;
    expect(new Date(started.attendedSince!).getTime()).toBeGreaterThanOrEqual(new Date(assigned.attendedSince!).getTime());
  });

  it('el auditor lee todo y no modifica nada', async () => {
    await store.signInAs(EUserRole.AUDITOR);
    expect(ability.can('read', 'Ticket')).toBe(true);
    expect(ability.can('read', 'AuditLog')).toBe(true);
    // Sobre un ticket AJENO (con instancia: las reglas de titular llevan condición) no puede nada.
    const someoneElses = subject('Ticket', { ownerUuid: '0b8a5f6e-1c2d-4e3f-8a9b-000000000002' });
    expect(ability.can('create', 'Ticket')).toBe(false);
    expect(ability.can('update', someoneElses)).toBe(false);
    expect(ability.can('delete', someoneElses)).toBe(false);
    const board = await get<IBoard>('/api/bff/board');
    expect(board.columns.flatMap((column) => column.tickets)).toHaveLength(3);
    expect((await ticket(TCK_001)).nextStatuses).toEqual([]);
    expect(await codeOf(send('post', `/api/tickets/${TCK_001}/transitions`, { to: 'resolved', resolution: 'Se reinició el servicio y quedó estable.' }))).toBe('SAUT-E001');
  });

  it('las opciones de catálogo traen ícono y color (insignias)', async () => {
    await store.signInAs(EUserRole.VIEWER);
    const options = await get<{ data: { value: string; label: string; icon: string | null; severity: string | null }[] }>('/api/catalogs/ticket-priority/options');
    expect(options.data.map((option) => option.value)).toEqual(['low', 'medium', 'high', 'critical']);
    expect(options.data.every((option) => !!option.icon && !!option.severity)).toBe(true);
    const types = await get<{ data: { value: string }[] }>('/api/catalogs/ticket-type/options');
    expect(types.data).toHaveLength(4);
    const complexity = await get<{ data: { value: string }[] }>('/api/catalogs/ticket-complexity/options');
    expect(complexity.data).toHaveLength(3);
  });

  it('el departamento de origen viene del catálogo: inexistente 422 STCK-E007, sin dato «it», y el listado filtra por él', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const base = { title: 'Sin red en ventas', description: '', type: 'incident', category: 'network', priority: 'high' };
    expect(await codeOf(send('post', '/api/tickets', { ...base, department: 'marte' }))).toBe('STCK-E007');
    expect(((await send('post', '/api/tickets', base)) as ITicketRow & { department: string }).department).toBe('it');
    await send('post', '/api/tickets', { ...base, department: 'finance' });
    const page = await get<{ data: { department: string }[] }>('/api/tickets?department=finance');
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.every((t) => t.department === 'finance')).toBe(true);
    const options = await get<{ data: { value: string; label: string }[] }>('/api/catalogs/ticket-department/options');
    expect(options.data.find((o) => o.value === 'it')?.label).toBe('TI (interno)');
  });
});
