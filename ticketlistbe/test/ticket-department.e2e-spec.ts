import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** Departamento de origen de la solicitud (catálogo editable `ticket-department`; `it` = interno de TI). */
describe('Ticket: departamento de origen (e2e)', () => {
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

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD }).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('XSRF-TOKEN=')) ?? '';
    const xsrf = decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
    return { get: (u: string) => agent.get(u), post: (u: string) => agent.post(u).set('X-XSRF-TOKEN', xsrf), patch: (u: string) => agent.patch(u).set('X-XSRF-TOKEN', xsrf) };
  }

  const body = (department?: string) => ({ title: 'No abre el correo', description: '', type: 'incident', category: 'email', priority: 'high', ...(department ? { department } : {}) });

  it('el catálogo ofrece los departamentos y «TI (interno)»', async () => {
    const victor = await login('victor@ticketit.dev');
    const options = await victor.get('/api/catalogs/ticket-department/options').expect(200);
    expect(options.body.data.map((o: { value: string }) => o.value)).toEqual(expect.arrayContaining(['it', 'hr', 'finance']));
    expect(options.body.data.find((o: { value: string }) => o.value === 'it').label).toBe('TI (interno)');
  });

  it('un departamento válido se guarda; sin dato se asume «it»; uno inexistente 422 STCK-E007', async () => {
    const victor = await login('victor@ticketit.dev');
    expect((await victor.post('/api/tickets').send(body('finance')).expect(201)).body.department).toBe('finance');
    expect((await victor.post('/api/tickets').send(body()).expect(201)).body.department).toBe('it');
    const bad = await victor.post('/api/tickets').send(body('marte')).expect(422);
    expect(bad.body.code).toBe('STCK-E007');
  });

  it('un departamento desactivado ya no se ofrece, pero un ticket viejo se sigue editando', async () => {
    const victor = await login('victor@ticketit.dev');
    const created = (await victor.post('/api/tickets').send(body('sales')).expect(201)).body;
    const marta = await login('marta@ticketit.dev');
    const detail = (await marta.get('/api/catalogs/ticket-department').expect(200)).body;
    const sales = detail.items.find((i: { code: string }) => i.code === 'sales');
    await marta.patch(`/api/catalogs/ticket-department/items/${sales.uuid}`).send({ code: 'sales', label: 'Ventas', order: 40, active: false }).expect(200);
    expect((await victor.post('/api/tickets').send(body('sales')).expect(422)).body.code).toBe('STCK-E007');
    const edit = { ...body('sales'), title: 'No abre el correo (editado)', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: false };
    await victor.patch(`/api/tickets/${created.uuid}`).send(edit).expect(200);
  });

  it('se puede filtrar el listado por departamento, tipo y categoría', async () => {
    const marta = await login('marta@ticketit.dev');
    await marta.post('/api/tickets').send(body('hr')).expect(201);
    const hr = (await marta.get('/api/tickets?department=hr').expect(200)).body;
    expect(hr.data.length).toBeGreaterThan(0);
    expect(hr.data.every((t: { department: string }) => t.department === 'hr')).toBe(true);
    const none = (await marta.get('/api/tickets?department=hr&category=network').expect(200)).body;
    expect(none.data).toHaveLength(0);
  });
});
