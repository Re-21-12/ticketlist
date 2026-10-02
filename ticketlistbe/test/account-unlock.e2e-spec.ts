import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const ANA = 'ana@ticketit.dev';
const ANA_UUID = '0b8a5f6e-1c2d-4e3f-8a9b-000000000002';

/** Bloqueo por intentos fallidos (CU07 A3): solo un administrador desbloquea. */
describe('Cuenta bloqueada: desbloqueo por la administración (e2e)', () => {
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

  const api = () => request(app.getHttpServer());

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD }).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('XSRF-TOKEN=')) ?? '';
    const xsrf = decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
    return { get: (u: string) => agent.get(u), patch: (u: string) => agent.patch(u).set('X-XSRF-TOKEN', xsrf) };
  }

  const lockAna = async () => {
    for (let i = 0; i < 5; i++) await api().post('/api/auth/sign-in').send({ email: ANA, password: `Mala-${i}-Clave!` });
  };

  it('el administrador la ve bloqueada, se le avisa, la desbloquea y la persona vuelve a entrar', async () => {
    await lockAna();
    const marta = await login('marta@ticketit.dev');
    const row = await marta.get(`/api/users/${ANA_UUID}`).expect(200);
    expect(row.body).toMatchObject({ locked: true });
    expect(row.body.lockedAt).toEqual(expect.any(String));

    const notices = await marta.get('/api/notifications').expect(200);
    expect(notices.body.data.some((n: { type: string; message: string }) => n.type === 'ACCOUNT_LOCKED' && n.message.includes(ANA))).toBe(true);

    await api().post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(423);
    const unlocked = await marta.patch(`/api/users/${ANA_UUID}/status`).send({ disabled: false, locked: false }).expect(200);
    expect(unlocked.body).toMatchObject({ locked: false, lockedAt: null });
    await api().post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(200);
  });

  it('solo administración desbloquea: un agente o supervisor recibe 403', async () => {
    await lockAna();
    const sergio = await login('sergio@ticketit.dev');
    await sergio.patch(`/api/users/${ANA_UUID}/status`).send({ disabled: false, locked: false }).expect(403);
    await api().post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(423);
  });

  it('bloquear no se puede pedir (locked solo acepta false)', async () => {
    const marta = await login('marta@ticketit.dev');
    await marta.patch(`/api/users/${ANA_UUID}/status`).send({ disabled: false, locked: true }).expect(400);
  });
});
