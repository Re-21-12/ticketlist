import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { PersistenceService } from './../src/database/persistence.service.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const DATABASE_URL = process.env['DATABASE_URL'];

/**
 * Persistencia con TypeORM contra un Postgres REAL (`bun run test:pg`; se omite sin `DATABASE_URL`): lo que se
 * escribe en una instancia lo recupera OTRA instancia que arranca después (reinicio / nuevo despliegue), y las
 * semillas no se duplican ni pisan lo editado.
 */
describe.skipIf(!DATABASE_URL)('Persistencia TypeORM (Postgres)', () => {
  let app: INestApplication<App>;

  /** Arranca una instancia NUEVA (memoria vacía + hidratación desde la base). `reset` vacía las tablas antes. */
  async function boot(reset: boolean): Promise<void> {
    process.env['NODE_ENV'] = 'test';
    process.env['DB_PERSISTENCE'] = 'true';
    process.env['DB_RESET_ON_START'] = reset ? 'true' : 'false';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, loadEnv());
    await app.init();
  }

  /** Espera las escrituras en cola y apaga la instancia (como un reinicio ordenado). */
  async function shutdown(): Promise<void> {
    await app.get(PersistenceService).flush();
    await app.close();
  }

  afterEach(async () => {
    delete process.env['DB_PERSISTENCE'];
    delete process.env['DB_RESET_ON_START'];
  });

  async function login(email: string, password = DEV_PASSWORD) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password }).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('XSRF-TOKEN=')) ?? '';
    const xsrf = decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
    return {
      get: (url: string) => agent.get(url),
      post: (url: string) => agent.post(url).set('X-XSRF-TOKEN', xsrf),
      patch: (url: string) => agent.patch(url).set('X-XSRF-TOKEN', xsrf),
    };
  }

  it('usuarios, tickets, historial, catálogos y notificaciones sobreviven a un reinicio; las semillas no se duplican', async () => {
    await boot(true);
    const api = () => request(app.getHttpServer());

    // 1) Una cuenta nueva (contraseña con hash + sal).
    await api().post('/api/auth/sign-up').send({ name: 'Nora Nueva', email: 'nora@ticketit.dev', password: 'Clave-Nueva-2026!' }).expect(201);

    // 2) Un ticket del cliente + un comentario del equipo (genera historial, notificación y evento).
    const victor = await login('victor@ticketit.dev');
    const created = (
      await victor
        .post('/api/tickets')
        .send({ title: 'No abre el correo', description: '<p>Desde ayer</p>', type: 'incident', category: 'email', priority: 'high', department: 'finance' })
        .expect(201)
    ).body;
    const ana = await login('ana@ticketit.dev');
    const marta = await login('marta@ticketit.dev');
    await marta.patch(`/api/tickets/${created.uuid}`).send({ ...created, assigneeEmail: 'ana@ticketit.dev', estimateHours: 2, dueDate: null }).expect(200);
    await ana.post(`/api/tickets/${created.uuid}/comments`).send({ body: 'Ya lo estoy revisando', internal: false }).expect(201);

    // 3) Un catálogo editado por el administrador (etiqueta de un departamento) y el menú intacto.
    const catalog = (await marta.get('/api/catalogs/ticket-department').expect(200)).body;
    const finance = catalog.items.find((i: { code: string }) => i.code === 'finance');
    await marta.patch(`/api/catalogs/ticket-department/items/${finance.uuid}`).send({ code: 'finance', label: 'Finanzas y Tesorería', order: finance.order, active: true }).expect(200);
    const menuBefore = (await marta.get('/api/menu-items?take=100').expect(200)).body.meta.total;
    const permsBefore = (await marta.get('/api/role-permissions?take=100').expect(200)).body.meta.total;

    await shutdown();

    // ── REINICIO: instancia nueva, memoria vacía, la base conserva todo ───────────────────────────
    await boot(false);
    const api2 = () => request(app.getHttpServer());

    // La cuenta nueva entra con SU contraseña (el hash se guardó) y las de siempre siguen igual (sin duplicarse).
    await api2().post('/api/auth/sign-in').send({ email: 'nora@ticketit.dev', password: 'Clave-Nueva-2026!' }).expect(200);
    const victor2 = await login('victor@ticketit.dev');
    const marta2 = await login('marta@ticketit.dev');
    const users = (await marta2.get('/api/users?take=100').expect(200)).body.meta.total;
    expect(users).toBe(8); // 7 de demostración + Nora: ninguna se duplicó al re-sembrar

    // El ticket, su asignación y su historial.
    const ticket = (await victor2.get(`/api/tickets/${created.uuid}`).expect(200)).body;
    expect(ticket).toMatchObject({ code: created.code, department: 'finance', assigneeEmail: 'ana@ticketit.dev', status: 'assigned', description: '<p>Desde ayer</p>' });
    const events = (await victor2.get(`/api/tickets/${created.uuid}/events`).expect(200)).body;
    expect(events.data.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['CREATED', 'ASSIGNED', 'COMMENT_PUBLIC']));

    // El catálogo editado conserva la edición (la semilla NO la pisa) y la numeración continúa sin repetir códigos.
    const options = (await victor2.get('/api/catalogs/ticket-department/options').expect(200)).body.data;
    expect(options.find((o: { value: string }) => o.value === 'finance').label).toBe('Finanzas y Tesorería');
    const next = (await victor2.post('/api/tickets').send({ title: 'Otro caso', description: '', type: 'inquiry', category: 'other', otherCategoryDetail: 'x', priority: 'low' }).expect(201)).body;
    expect(next.code).not.toBe(created.code);

    // Semillas estáticas: ni más ni menos filas que antes.
    expect((await marta2.get('/api/menu-items?take=100').expect(200)).body.meta.total).toBe(menuBefore);
    expect((await marta2.get('/api/role-permissions?take=100').expect(200)).body.meta.total).toBe(permsBefore);

    // La notificación del ticket asignado (Ana) también persiste, y el tablero arma sus columnas.
    const ana2 = await login('ana@ticketit.dev');
    const notices = (await ana2.get('/api/notifications').expect(200)).body.data;
    expect(notices.some((n: { type: string; resourceUuid: string }) => n.type === 'TICKET_ASSIGNED' && n.resourceUuid === created.uuid)).toBe(true);
    expect((await marta2.get('/api/bff/board').expect(200)).body.columns).toHaveLength(3);

    // Las migraciones quedaron registradas (y la de auditoría creó su tabla).
    await app.get(PersistenceService).flush();
    const health = (await api2().get('/api/health/ready').expect(200)).body;
    expect(health.checks.postgres).toBe('up');

    await shutdown();
  });
});
