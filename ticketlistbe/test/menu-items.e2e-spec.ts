import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

interface IMenu {
  key: string;
  route: string;
}

/** Menú administrable: solo ADMIN lo edita, las rutas son internas y el shell refleja el cambio. */
describe('Menú administrable (e2e)', () => {
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

  const login = async (email: string) => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD });
    const csrf = (res.headers['set-cookie'] as unknown as string[] | undefined)
      ?.find((c) => c.startsWith('XSRF-TOKEN='))
      ?.split(';')[0]
      ?.split('=')[1];
    return { agent, csrf: csrf ?? '' };
  };

  const valid = { key: 'reports', label: 'Reportes', route: '/reports', group: 'Tickets', order: 15 };
  const shellMenu = async (s: Awaited<ReturnType<typeof login>>): Promise<IMenu[]> =>
    (await s.agent.get('/api/bff/shell').expect(200)).body.menu as IMenu[];

  it('un AGENT no lista ni edita el menú (403 SAUT-E001)', async () => {
    const ana = await login('ana@ticketit.dev');
    expect((await ana.agent.get('/api/menu-items').expect(403)).body.code).toBe('SAUT-E001');
    await ana.agent.post('/api/menu-items').set('X-XSRF-TOKEN', ana.csrf).send(valid).expect(403);
  });

  it('el shell trae el menú sembrado, ordenado por `order`, con íconos', async () => {
    const menu = await shellMenu(await login('ana@ticketit.dev'));
    expect(menu.map((m) => m.key)).toEqual(expect.arrayContaining(['board', 'profile', 'users', 'audit-logs']));
    const orders = (await (await login('marta@ticketit.dev')).agent.get('/api/menu-items?take=100').expect(200)).body.data.map(
      (m: { order: number }) => m.order,
    );
    expect(orders.length).toBeGreaterThan(10);
  });

  it('ADMIN crea, edita y elimina; el shell lo refleja', async () => {
    const admin = await login('marta@ticketit.dev');
    const created = await admin.agent.post('/api/menu-items').set('X-XSRF-TOKEN', admin.csrf).send(valid).expect(201);
    expect(created.body).toMatchObject({ key: 'reports', active: true, icon: null, subject: null });
    expect((await shellMenu(admin)).some((m) => m.key === 'reports')).toBe(true);

    const uuid = created.body.uuid as string;
    await admin.agent
      .patch(`/api/menu-items/${uuid}`)
      .set('X-XSRF-TOKEN', admin.csrf)
      .send({ ...valid, active: false })
      .expect(200);
    expect((await shellMenu(admin)).some((m) => m.key === 'reports')).toBe(false);

    await admin.agent.delete(`/api/menu-items/${uuid}`).set('X-XSRF-TOKEN', admin.csrf).expect(204);
    expect((await admin.agent.get(`/api/menu-items/${uuid}`).expect(410)).body.code).toBe('RMNU-E003');
  });

  it('rechaza rutas externas o con esquema, claves y íconos inválidos (400)', async () => {
    const admin = await login('marta@ticketit.dev');
    const post = (body: object) => admin.agent.post('/api/menu-items').set('X-XSRF-TOKEN', admin.csrf).send(body);
    for (const route of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', 'tickets', '/a\\b']) {
      const res = await post({ ...valid, route }).expect(400);
      expect(res.body.errors.some((e: { path: string }) => e.path === 'route')).toBe(true);
    }
    await post({ ...valid, key: 'Mala Clave' }).expect(400);
    await post({ ...valid, icon: '<script>' }).expect(400);
    await post({ ...valid, subject: 'Nada' }).expect(400);
  });

  it('la clave es única (409 RMNU-E002) y GET :uuid inexistente da 404 RMNU-E001', async () => {
    const admin = await login('marta@ticketit.dev');
    const dup = await admin.agent
      .post('/api/menu-items')
      .set('X-XSRF-TOKEN', admin.csrf)
      .send({ ...valid, key: 'board' })
      .expect(409);
    expect(dup.body.code).toBe('RMNU-E002');
    const miss = await admin.agent.get('/api/menu-items/00000000-0000-4000-8000-000000000000').expect(404);
    expect(miss.body.code).toBe('RMNU-E001');
  });
});
