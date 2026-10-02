import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** Administración de relaciones: solo ADMIN ve todas y revoca cualquiera; el historial se conserva. */
describe('Relaciones · administración (e2e)', () => {
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
  type TSession = Awaited<ReturnType<typeof login>>;

  const share = (s: TSession, alternanteEmail: string) =>
    s.agent
      .post('/api/relationships')
      .set('X-XSRF-TOKEN', s.csrf)
      .send({
        alternanteEmail,
        grants: [{ objectType: 'Ticket', canRead: true, canUpdate: true, notifyTitular: true }],
        consent: true,
      });

  it('un titular común (AGENT) no accede a la vista de administración (403 SAUT-E001)', async () => {
    const ana = await login('ana@ticketit.dev');
    expect((await ana.agent.get('/api/relationships/admin').expect(403)).body.code).toBe('SAUT-E001');
    await ana.agent.delete('/api/relationships/admin/00000000-0000-4000-8000-000000000000').set('X-XSRF-TOKEN', ana.csrf).expect(403);
  });

  it('ADMIN ve las relaciones de TODAS las personas con nombres, estado y lo concedido; filtra y busca', async () => {
    const ana = await login('ana@ticketit.dev');
    await share(ana, 'victor@ticketit.dev').expect(201);
    const luis = await login('luis@ticketit.dev');
    await share(luis, 'ana@ticketit.dev').expect(201);

    const admin = await login('marta@ticketit.dev');
    const all = await admin.agent.get('/api/relationships/admin').expect(200);
    expect(all.body.meta.total).toBe(2);
    const row = all.body.data.find((r: { titularEmail: string }) => r.titularEmail === 'ana@ticketit.dev');
    expect(row).toMatchObject({
      titularName: 'Ana Agente',
      alternanteEmail: 'victor@ticketit.dev',
      status: 'ACTIVE',
      canRead: true,
      canUpdate: true,
    });
    const found = await admin.agent.get('/api/relationships/admin?search=luis').expect(200);
    expect(found.body.data.map((r: { titularEmail: string }) => r.titularEmail)).toEqual(['luis@ticketit.dev']);
    const none = await admin.agent.get('/api/relationships/admin?status=REVOKED').expect(200);
    expect(none.body.meta.total).toBe(0);
  });

  it('ADMIN revoca una relación ajena: pierde el acceso al instante, queda el historial y avisa a las dos personas', async () => {
    const ana = await login('ana@ticketit.dev');
    const created = (await share(ana, 'victor@ticketit.dev').expect(201)).body as { uuid: string };
    const victor = await login('victor@ticketit.dev');
    const before = await victor.agent.get('/api/bff/shell').expect(200);
    expect(JSON.stringify(before.body.abilityRules)).toContain('$in');

    const admin = await login('marta@ticketit.dev');
    await admin.agent.delete(`/api/relationships/admin/${created.uuid}`).set('X-XSRF-TOKEN', admin.csrf).expect(204);

    const after = await victor.agent.get('/api/bff/shell').expect(200);
    expect(JSON.stringify(after.body.abilityRules)).not.toContain('$in');
    const history = await admin.agent.get('/api/relationships/admin?status=REVOKED').expect(200);
    expect(history.body.data[0]).toMatchObject({ uuid: created.uuid, status: 'REVOKED' });
    expect(history.body.data[0].endedAt).not.toBeNull();

    for (const session of [ana, victor]) {
      const notifications = await session.agent.get('/api/notifications').expect(200);
      expect(notifications.body.data.some((n: { type: string }) => n.type === 'RELATIONSHIP_REVOKED')).toBe(true);
    }
    // Ya revocada: no se revoca dos veces.
    expect((await admin.agent.delete(`/api/relationships/admin/${created.uuid}`).set('X-XSRF-TOKEN', admin.csrf).expect(404)).body.code).toBe('RREL-E001');
  });
});
