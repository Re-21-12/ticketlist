import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD, USERS_SEED } from './../src/modules/users/users.seed.js';

const uuidOf = (email: string): string => USERS_SEED.find((u) => u.email === email)!.uuid;

interface IEntry {
  action: string;
  subject: string;
  route: string;
  outcome: string;
  status: number;
  actorEmail: string | null;
  resourceUuid: string | null;
  changedFields: string[];
}

/** Auditoría: toda mutación deja huella (también las denegadas), sin valores sensibles; solo ADMIN la lee. */
describe('Auditoría (e2e)', () => {
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

  const entries = async (admin: Awaited<ReturnType<typeof login>>, query = ''): Promise<IEntry[]> =>
    (await admin.agent.get(`/api/audit-logs?take=100${query}`).expect(200)).body.data as IEntry[];

  it('solo ADMIN consulta la auditoría (403 SAUT-E001 para los demás)', async () => {
    for (const email of ['ana@ticketit.dev', 'victor@ticketit.dev']) {
      const s = await login(email);
      expect((await s.agent.get('/api/audit-logs').expect(403)).body.code).toBe('SAUT-E001');
    }
  });

  it('registra el inicio de sesión, exitoso y fallido, sin guardar la contraseña', async () => {
    await login('ana@ticketit.dev', 'contraseña-equivocada-1');
    const admin = await login('marta@ticketit.dev');
    const log = await entries(admin, '&action=SIGN_IN');
    expect(log.map((e) => e.outcome)).toEqual(expect.arrayContaining(['SUCCESS', 'DENIED']));
    const ok = log.find((e) => e.outcome === 'SUCCESS');
    expect(ok?.actorEmail).toBe('marta@ticketit.dev');
    expect(JSON.stringify(log)).not.toContain('equivocada');
    expect(JSON.stringify(log)).not.toContain(DEV_PASSWORD);
  });

  it('una mutación deja actor, ruta con plantilla, recurso y NOMBRES de campos (no valores)', async () => {
    const admin = await login('marta@ticketit.dev');
    const victor = uuidOf('victor@ticketit.dev');
    await admin.agent.patch(`/api/users/${victor}/role`).set('X-XSRF-TOKEN', admin.csrf).send({ role: 'AGENT' }).expect(200);

    const [last] = await entries(admin, '&subject=users');
    expect(last).toMatchObject({
      action: 'UPDATE',
      subject: 'users',
      route: '/api/users/:uuid/role',
      resourceUuid: victor,
      outcome: 'SUCCESS',
      actorEmail: 'marta@ticketit.dev',
      changedFields: ['role'],
    });
    expect(JSON.stringify(last)).not.toContain('"AGENT"');
  });

  it('queda registrada también la mutación DENEGADA (403) y la inválida (400)', async () => {
    const ana = await login('ana@ticketit.dev');
    await ana.agent
      .patch(`/api/users/${uuidOf('victor@ticketit.dev')}/role`)
      .set('X-XSRF-TOKEN', ana.csrf)
      .send({ role: 'ADMIN' })
      .expect(403);
    const admin = await login('marta@ticketit.dev');
    await admin.agent
      .patch(`/api/users/${uuidOf('victor@ticketit.dev')}/role`)
      .set('X-XSRF-TOKEN', admin.csrf)
      .send({ role: 'NOPE' })
      .expect(400);

    const log = await entries(admin, '&subject=users');
    expect(log.find((e) => e.outcome === 'DENIED')).toMatchObject({ actorEmail: 'ana@ticketit.dev', status: 403 });
    expect(log.find((e) => e.outcome === 'FAILED')).toMatchObject({ actorEmail: 'marta@ticketit.dev', status: 400 });
  });

  it('las lecturas no se registran y el registro es de solo lectura (no hay POST/PATCH/DELETE)', async () => {
    const admin = await login('marta@ticketit.dev');
    await admin.agent.get('/api/users').expect(200);
    const log = await entries(admin);
    expect(log.some((e) => e.route === '/api/users' && e.action !== 'CREATE')).toBe(false);
    for (const method of ['post', 'patch', 'delete'] as const) {
      const res = await admin.agent[method]('/api/audit-logs').set('X-XSRF-TOKEN', admin.csrf).send({});
      expect([404, 405]).toContain(res.status);
    }
  });

  it('filtra por resultado, búsqueda y pagina; GET :uuid 404 SAUD-E001', async () => {
    const ana = await login('ana@ticketit.dev', 'mala-contraseña-1');
    expect(ana.status).toBe(401);
    const admin = await login('marta@ticketit.dev');
    const denied = await entries(admin, '&outcome=DENIED');
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.every((e) => e.outcome === 'DENIED')).toBe(true);
    const page = await admin.agent.get('/api/audit-logs?take=1&page=1').expect(200);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta.total).toBeGreaterThan(1);
    const miss = await admin.agent.get('/api/audit-logs/00000000-0000-4000-8000-000000000000').expect(404);
    expect(miss.body.code).toBe('SAUD-E001');
  });
});
