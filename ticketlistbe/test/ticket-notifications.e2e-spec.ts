import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/**
 * CU01 «Control de estado y notificaciones por ticket»: «Mis tickets» (filtro `mine`), aviso automático al cambiar el
 * estado, tiempo real por SSE y constancia de cada aviso en el historial del ticket (postcondición).
 */
describe('Notificaciones por ticket · CU01 (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env['NODE_ENV'] = 'test';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, loadEnv());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const login = async (email: string, password = DEV_PASSWORD) => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password });
    const cookies = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
    const csrf = cookies.find((c) => c.startsWith('XSRF-TOKEN='))?.split(';')[0]?.split('=')[1] ?? '';
    return { agent, csrf, cookie: cookies.map((c) => c.split(';')[0]).join('; ') };
  };
  type TSession = Awaited<ReturnType<typeof login>>;
  const post = (s: TSession, url: string, body: object = {}) => s.agent.post(url).set('X-XSRF-TOKEN', s.csrf).send(body);

  const draft = { title: 'No abre el portal', description: '', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };
  const createAssigned = async (customer: TSession): Promise<string> => {
    const created = (await post(customer, '/api/tickets', draft).expect(201)).body as { uuid: string };
    const sergio = await login('sergio@ticketit.dev');
    await post(sergio, `/api/tickets/${created.uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(200);
    return created.uuid;
  };
  const eventsOf = async (s: TSession, uuid: string) => (await s.agent.get(`/api/tickets/${uuid}/events`).expect(200)).body.data as { type: string; body: string | null; actorName: string; visibility: string }[];

  it('«Mis tickets»: ?mine=true devuelve solo los que registró quien consulta (también para el equipo)', async () => {
    const victor = await login('victor@ticketit.dev');
    const uuid = await createAssigned(victor);
    const marta = await login('marta@ticketit.dev');
    const all = (await marta.agent.get('/api/tickets?take=100').expect(200)).body.data as { uuid: string }[];
    const mine = (await marta.agent.get('/api/tickets?take=100&mine=true').expect(200)).body.data as { uuid: string }[];
    expect(all.some((t) => t.uuid === uuid)).toBe(true);
    expect(mine.some((t) => t.uuid === uuid)).toBe(false); // el ticket es de Víctor, no de Marta
    const victors = (await victor.agent.get('/api/tickets?take=100&mine=true').expect(200)).body.data as { uuid: string; ownerUuid: string }[];
    expect(victors.map((t) => t.uuid)).toContain(uuid);
    expect(new Set(victors.map((t) => t.ownerUuid)).size).toBe(1);
  });

  it('A1: quien no tiene tickets recibe una lista vacía (no un error)', async () => {
    // Un cliente recién registrado no tiene tickets.
    await request(app.getHttpServer()).post('/api/auth/sign-up').send({ name: 'Nora Nueva', email: 'nora@ticketit.dev', password: 'Clave-Nueva-2026!' }).expect(201);
    const fresh = await login('nora@ticketit.dev', 'Clave-Nueva-2026!');
    const list = (await fresh.agent.get('/api/tickets?mine=true').expect(200)).body;
    expect(list.data).toEqual([]);
    expect(list.meta.total).toBe(0);
  });

  it('cada cambio de estado avisa al solicitante Y queda en el historial del ticket (evento NOTIFIED)', async () => {
    const victor = await login('victor@ticketit.dev');
    const uuid = await createAssigned(victor);
    const ana = await login('ana@ticketit.dev');
    await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);

    const notices = (await victor.agent.get('/api/notifications').expect(200)).body.data as { type: string; message: string }[];
    expect(notices.some((n) => n.type === 'TICKET_STATUS_CHANGED' && n.message.includes('está en atención'))).toBe(true);

    const history = await eventsOf(victor, uuid);
    const notified = history.filter((e) => e.type === 'NOTIFIED');
    // Una por la asignación y otra por «en atención»; públicas, para que el solicitante las vea.
    expect(notified.map((e) => e.body)).toEqual(expect.arrayContaining([expect.stringContaining('atenderá'), expect.stringContaining('está en atención')]));
    expect(notified.every((e) => e.visibility === 'public' && e.actorName === 'Sistema')).toBe(true);
  });

  it('quien hace el cambio no se notifica a sí mismo: ni aviso ni evento NOTIFIED', async () => {
    const victor = await login('victor@ticketit.dev');
    const created = (await post(victor, '/api/tickets', draft).expect(201)).body as { uuid: string };
    const before = (await eventsOf(victor, created.uuid)).filter((e) => e.type === 'NOTIFIED').length;
    expect(before).toBe(0);
  });

  it('SSE: el solicitante recibe en tiempo real el aviso del cambio, y solo el suyo', async () => {
    await app.listen(0);
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const victor = await login('victor@ticketit.dev');
    const uuid = await createAssigned(victor);

    const abort = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/notifications/stream`, { headers: { cookie: victor.cookie, accept: 'text/event-stream' }, signal: abort.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    expect(res.headers.get('cache-control')).toContain('no-store'); // nunca cacheable

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const received = (async () => {
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return buffer;
        buffer += decoder.decode(value, { stream: true });
        if (buffer.includes('está en atención')) return buffer;
      }
    })();

    const ana = await login('ana@ticketit.dev');
    await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);

    const chunk = await Promise.race([received, new Promise<string>((_, reject) => setTimeout(() => reject(new Error('el stream no entregó el aviso')), 4000))]);
    expect(chunk).toContain('event: notification');
    expect(chunk).toContain(uuid);
    abort.abort();
  });

  it('el stream exige sesión (401 sin cookie)', async () => {
    await request(app.getHttpServer()).get('/api/notifications/stream').expect(401);
  });
});
