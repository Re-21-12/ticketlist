import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD, USERS_SEED } from './../src/modules/users/users.seed.js';

const uuidOf = (email: string): string => USERS_SEED.find((u) => u.email === email)!.uuid;

/** Administración de usuarios: solo ADMIN, sin autobloqueo y siempre con un administrador activo. */
describe('Usuarios · administración (e2e)', () => {
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
    const csrf = (res.headers['set-cookie'] as unknown as string[] | undefined)
      ?.find((c) => c.startsWith('XSRF-TOKEN='))
      ?.split(';')[0]
      ?.split('=')[1];
    return { agent, csrf: csrf ?? '', status: res.status };
  };

  const patch = (s: Awaited<ReturnType<typeof login>>, url: string, body: object) =>
    s.agent.patch(url).set('X-XSRF-TOKEN', s.csrf).send(body);

  it('un AGENT o VIEWER no lista usuarios (403 SAUT-E001)', async () => {
    for (const email of ['ana@ticketit.dev', 'victor@ticketit.dev']) {
      const s = await login(email);
      const res = await s.agent.get('/api/users').expect(403);
      expect(res.body.code).toBe('SAUT-E001');
    }
  });

  it('ADMIN lista con búsqueda, filtro por rol y paginación, sin datos sensibles', async () => {
    const admin = await login('marta@ticketit.dev');
    const all = await admin.agent.get('/api/users').expect(200);
    expect(all.body.meta.total).toBe(USERS_SEED.length);
    expect(JSON.stringify(all.body)).not.toMatch(/password|hash|salt/i);

    const viewers = await admin.agent.get('/api/users?role=VIEWER').expect(200);
    expect(viewers.body.data.every((u: { role: string }) => u.role === 'VIEWER')).toBe(true);

    const found = await admin.agent.get('/api/users?search=ana').expect(200);
    expect(found.body.data.map((u: { email: string }) => u.email)).toContain('ana@ticketit.dev');

    const paged = await admin.agent.get('/api/users?take=1&page=2').expect(200);
    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ page: 2, take: 1 });
  });

  it('GET :uuid 404 SUSR-E002 si no existe', async () => {
    const admin = await login('marta@ticketit.dev');
    const res = await admin.agent.get('/api/users/00000000-0000-4000-8000-000000000000').expect(404);
    expect(res.body.code).toBe('SUSR-E002');
  });

  it('cambiar el rol rige desde la siguiente request del usuario', async () => {
    const admin = await login('marta@ticketit.dev');
    const victor = await login('victor@ticketit.dev');
    await victor.agent.get('/api/users').expect(403);

    const res = await patch(admin, `/api/users/${uuidOf('victor@ticketit.dev')}/role`, { role: 'ADMIN' }).expect(200);
    expect(res.body.role).toBe('ADMIN');
    await victor.agent.get('/api/users').expect(200);
  });

  it('rechaza campos extra (asignación masiva) y roles inválidos', async () => {
    const admin = await login('marta@ticketit.dev');
    const url = `/api/users/${uuidOf('victor@ticketit.dev')}/role`;
    await patch(admin, url, { role: 'AGENT', emailVerified: false }).expect(400);
    await patch(admin, url, { role: 'SUPERUSER' }).expect(400);
  });

  it('repetir el valor actual es idempotente (200), también sobre sí mismo', async () => {
    const admin = await login('marta@ticketit.dev');
    const me = uuidOf('marta@ticketit.dev');
    await patch(admin, `/api/users/${me}/role`, { role: 'ADMIN' }).expect(200);
    await patch(admin, `/api/users/${me}/status`, { disabled: false }).expect(200);
  });

  it('nadie cambia su propio rol ni se deshabilita a sí mismo (SUSR-E003)', async () => {
    const admin = await login('marta@ticketit.dev');
    const me = uuidOf('marta@ticketit.dev');
    expect((await patch(admin, `/api/users/${me}/role`, { role: 'VIEWER' }).expect(409)).body.code).toBe('SUSR-E003');
    expect((await patch(admin, `/api/users/${me}/status`, { disabled: true }).expect(409)).body.code).toBe('SUSR-E003');
  });

  it('siempre queda un administrador activo (SUSR-E004)', async () => {
    const marta = await login('marta@ticketit.dev');
    // Un AGENT con permiso de editar usuarios (configurado por ADMIN) intenta dejar el sistema sin admin.
    await marta.agent
      .post('/api/role-permissions')
      .set('X-XSRF-TOKEN', marta.csrf)
      .send({ role: 'AGENT', subject: 'User', action: 'update', condition: 'NONE' })
      .expect(201);
    const ana = await login('ana@ticketit.dev');
    const martaUuid = uuidOf('marta@ticketit.dev');
    expect((await patch(ana, `/api/users/${martaUuid}/status`, { disabled: true }).expect(409)).body.code).toBe('SUSR-E004');
    expect((await patch(ana, `/api/users/${martaUuid}/role`, { role: 'VIEWER' }).expect(409)).body.code).toBe('SUSR-E004');
  });

  it('deshabilitar cierra sus sesiones y le impide volver a entrar; habilitar lo permite', async () => {
    const admin = await login('marta@ticketit.dev');
    const ana = await login('ana@ticketit.dev');
    await ana.agent.get('/api/bff/shell').expect(200);

    await patch(admin, `/api/users/${uuidOf('ana@ticketit.dev')}/status`, { disabled: true }).expect(200);
    await ana.agent.get('/api/bff/shell').expect(401);
    const again = await login('ana@ticketit.dev');
    expect(again.status).toBe(401);

    await patch(admin, `/api/users/${uuidOf('ana@ticketit.dev')}/status`, { disabled: false }).expect(200);
    expect((await login('ana@ticketit.dev')).status).toBe(200);
  });
});
