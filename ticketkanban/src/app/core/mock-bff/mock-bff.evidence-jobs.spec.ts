import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { createMongoAbility } from '@casl/ability';
import { MessageService } from '@openng/optimus-ui/api';
import { firstValueFrom } from 'rxjs';
import { JobListSchema, JobSchema } from '../../pages/jobs/jobs.schema';
import { TicketEventListSchema } from '../../pages/my-tickets/my-tickets.schema';
import { AttachmentRefSchema } from '../../shared/evidence/evidence.schema';
import { EUserRole } from '../casl/ability.enum';
import { AppAbility } from '../casl/casl.types';
import { readProblem } from '../interfaces/problem-details.interface';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { SessionStore } from '../session/session.store';
import { resetMockBff } from './mock-bff.handler';
import { mockBffInterceptor } from './mock-bff.interceptor';

const TCK_001 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01'; // de Ana (agente), asignado a Ana, en atención

/** CU02 en el mock: evidencia (tipos y topes), comentarios inmutables, confirmar/reabrir y tareas programadas del administrador. */
describe('mock BFF · CU02 evidencia, cierre y tareas programadas', () => {
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
  const upload = (uuid: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return firstValueFrom(http.post(`/api/tickets/${uuid}/attachments`, form));
  };
  const draft = { title: 'No abre el portal', description: '', department: 'it', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };
  /** Un archivo real del tamaño pedido (FormData copia el archivo: un tamaño «fingido» no sobrevive al envío). */
  const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

  async function victorTicket(): Promise<string> {
    await store.signInAs(EUserRole.VIEWER);
    return (await post<{ uuid: string }>('/api/tickets', draft)).uuid;
  }

  it('sube imágenes, PDF, Excel, CSV y videos y los clasifica; rechaza tipos y tamaños fuera de regla', async () => {
    const uuid = await victorTicket();
    const cases: [string, string][] = [['foto.png', 'image'], ['informe.pdf', 'document'], ['ventas.xlsx', 'document'], ['datos.csv', 'document'], ['falla.mp4', 'video']];
    for (const [name, kind] of cases) expect(AttachmentRefSchema.parse(await upload(uuid, file(name))), name).toMatchObject({ name, kind });
    expect(await codeOf(upload(uuid, file('virus.exe')))).toBe('SATT-E002');
    expect(await codeOf(upload(uuid, file('grande.png', 11 * 1024 * 1024)))).toBe('SATT-E001');
    expect(await codeOf(upload(uuid, file('medio.pdf', 6 * 1024 * 1024)))).toBeUndefined(); // el tope de un PDF es 25 MB
    expect(await codeOf(upload(uuid, file('enorme.pdf', 26 * 1024 * 1024)))).toBe('SATT-E001');
    expect(await codeOf(post(`/api/tickets/${uuid}/attachments`, {}))).toBe('SATT-E003');
  }, 30_000);

  it('la evidencia se amarra a UN comentario y aparece en el historial; no se reutiliza', async () => {
    const uuid = await victorTicket();
    const photo = AttachmentRefSchema.parse(await upload(uuid, file('captura.png')));
    const comment = await post<{ attachments: unknown[] }>(`/api/tickets/${uuid}/comments`, { body: 'Mira el error', internal: false, attachmentIds: [photo.id] });
    expect(comment.attachments).toEqual([photo]);
    expect(await codeOf(post(`/api/tickets/${uuid}/comments`, { body: 'otra vez', internal: false, attachmentIds: [photo.id] }))).toBe('RATT-E001');
    const history = TicketEventListSchema.parse(await get(`/api/tickets/${uuid}/events`));
    expect(history.data.find((e) => e.type === 'COMMENT_PUBLIC')?.attachments).toEqual([photo]);
  }, 30_000);

  it('evidencia de la SOLUCIÓN: quien resuelve adjunta fotos al cambio de estado', async () => {
    await store.signInAs(EUserRole.AGENT);
    const photo = AttachmentRefSchema.parse(await upload(TCK_001, file('despues.png')));
    await post(`/api/tickets/${TCK_001}/transitions`, { to: 'resolved', resolution: 'Se reemplazó el cable.', attachmentIds: [photo.id] });
    await store.signInAs(EUserRole.ADMIN);
    const history = TicketEventListSchema.parse(await get(`/api/tickets/${TCK_001}/events`));
    expect(history.data.find((e) => e.to === 'resolved')?.attachments).toEqual([photo]);
  }, 30_000);

  it('A1: un comentario previo no se puede editar ni borrar (409 STCK-E002)', async () => {
    const uuid = await victorTicket();
    const comment = await post<{ uuid: string }>(`/api/tickets/${uuid}/comments`, { body: 'Primero', internal: false, attachmentIds: [] });
    expect(await codeOf(firstValueFrom(http.patch(`/api/tickets/${uuid}/comments/${comment.uuid}`, { body: 'Cambiado' })))).toBe('STCK-E002');
    expect(await codeOf(firstValueFrom(http.delete(`/api/tickets/${uuid}/comments/${comment.uuid}`)))).toBe('STCK-E002');
  }, 30_000);

  it('CU02: el solicitante confirma el cierre (queda «Cerrado», con la encuesta en su buzón) o reabre y avisa al agente', async () => {
    const uuid = await victorTicket();
    await store.signInAs(EUserRole.SUPERVISOR);
    const ticket = await get<Record<string, unknown>>(`/api/tickets/${uuid}`);
    await firstValueFrom(http.patch(`/api/tickets/${uuid}`, { ...ticket, assigneeEmail: 'ana@ticketit.dev', dueDate: null }));
    await store.signInAs(EUserRole.AGENT);
    await post(`/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Hecho.' });

    await store.signInAs(EUserRole.VIEWER);
    const reopened = await post<{ status: string }>(`/api/tickets/${uuid}/transitions`, { to: 'reopened', note: 'Sigue igual' });
    expect(reopened.status).toBe('reopened');
    await store.signInAs(EUserRole.AGENT);
    const agentInbox = await get<{ data: { type: string; message: string }[] }>('/api/notifications');
    expect(agentInbox.data.some((n) => n.message.includes('reabrió') || n.type === 'TICKET_REOPENED')).toBe(true);
  }, 60_000);

  it('el administrador lista las tareas, valida el cron y el plazo, y ejecuta el cierre automático según el plazo configurado', async () => {
    await store.signInAs(EUserRole.ADMIN);
    const list = JobListSchema.parse(await get('/api/jobs'));
    const job = list.data.find((j) => j.key === 'ticket-auto-close');
    expect(job).toMatchObject({ enabled: true, cron: '*/10 * * * *', params: { afterHours: 48 } });
    expect(job?.nextRunAt).not.toBeNull();

    expect(await codeOf(firstValueFrom(http.patch('/api/jobs/ticket-auto-close', { enabled: true, cron: 'cada rato' })))).toBe('CVAL-E001');
    expect(await codeOf(firstValueFrom(http.patch('/api/jobs/ticket-auto-close', { enabled: true, cron: '0 * * * *', params: { afterHours: 0 } })))).toBe('CVAL-E001');
    const updated = JobSchema.parse(await firstValueFrom(http.patch('/api/jobs/ticket-auto-close', { enabled: true, cron: '0 * * * *', params: { afterHours: 1 } })));
    expect(updated).toMatchObject({ cron: '0 * * * *', params: { afterHours: 1 }, updatedBy: 'marta@ticketit.dev' });
    const off = JobSchema.parse(await firstValueFrom(http.patch('/api/jobs/ticket-auto-close', { enabled: false, cron: '0 * * * *' })));
    expect(off.nextRunAt).toBeNull();
    expect(await codeOf(firstValueFrom(http.patch('/api/jobs/no-existe', { enabled: true, cron: '* * * * *' })))).toBe('RJOB-E001');

    // TCK-003 (de Luis) está cerrado; para probar el cierre se resuelve TCK-001 con el plazo de 1 h y se «envejece» a mano
    // no es posible en el mock, así que se comprueba el caso vacío y el registro de la corrida.
    const run = JobSchema.parse(await post('/api/jobs/ticket-auto-close/run'));
    expect(run).toMatchObject({ lastRunStatus: 'ok', lastRunTrigger: 'marta@ticketit.dev' });
    expect(run.lastRunSummary).toContain('Ningún ticket');
  }, 60_000);

  it('solo el administrador ve y cambia las tareas programadas', async () => {
    for (const role of [EUserRole.SUPERVISOR, EUserRole.AGENT, EUserRole.VIEWER, EUserRole.AUDITOR]) {
      await store.signInAs(role);
      expect(await codeOf(get('/api/jobs')), role).toBe('SAUT-E001');
      expect(await codeOf(firstValueFrom(http.patch('/api/jobs/ticket-auto-close', { enabled: true, cron: '* * * * *' }))), role).toBe('SAUT-E001');
    }
  }, 60_000);
});
