import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD, USERS_SEED } from './../src/modules/users/users.seed.js';

const uuidOf = (email: string): string => USERS_SEED.find((u) => u.email === email)!.uuid;

/** Cuentas por la administración: alta, contraseña temporal de un solo uso (cambio obligatorio) y reinicio del autenticador. */
describe('Usuarios · cuentas por la administración (e2e)', () => {
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
    const csrf = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('XSRF-TOKEN='))?.split(';')[0]?.split('=')[1];
    return { agent, csrf: csrf ?? '', status: res.status, body: res.body as Record<string, unknown> };
  };
  const post = (s: Awaited<ReturnType<typeof login>>, url: string, body: object = {}) => s.agent.post(url).set('X-XSRF-TOKEN', s.csrf).send(body);

  it('un no administrador no puede crear ni restablecer (403 SAUT-E001)', async () => {
    const ana = await login('ana@ticketit.dev');
    expect((await post(ana, '/api/users', { name: 'Nuevo Usuario', email: 'n@x.com', role: 'AGENT' }).expect(403)).body.code).toBe('SAUT-E001');
    expect((await post(ana, `/api/users/${uuidOf('victor@ticketit.dev')}/reset-password`).expect(403)).body.code).toBe('SAUT-E001');
  });

  it('crear: devuelve una contraseña temporal una vez, valida el correo y rechaza duplicados', async () => {
    const admin = await login('marta@ticketit.dev');
    const created = await post(admin, '/api/users', { name: 'Nuevo Soporte', email: 'Nuevo@Ticketit.dev', role: 'AGENT' }).expect(201);
    expect(created.body.user).toMatchObject({ email: 'nuevo@ticketit.dev', role: 'AGENT', mustChangePassword: true, totpEnabled: false });
    expect(created.body.tempPassword).toMatch(/^.{16}$/);
    expect(JSON.stringify(created.body)).not.toMatch(/hash|salt/i);
    expect((await post(admin, '/api/users', { name: 'Otro', email: 'nuevo@ticketit.dev', role: 'AGENT' }).expect(409)).body.code).toBe('SUSR-E001');
    expect((await post(admin, '/api/users', { name: 'Otro', email: 'no-es-correo', role: 'AGENT' }).expect(400)).body.code).toBe('CVAL-E001');
  });

  it('la contraseña temporal obliga a cambiarla: todo da 403 SAUT-E015 salvo shell y cambio; después queda libre', async () => {
    const admin = await login('marta@ticketit.dev');
    const { body } = await post(admin, '/api/users', { name: 'Nuevo Soporte', email: 'nuevo@ticketit.dev', role: 'AGENT' }).expect(201);
    const session = await login('nuevo@ticketit.dev', body.tempPassword);
    expect(session.status).toBe(200);
    expect(session.body['mustChangePassword']).toBe(true);

    expect((await session.agent.get('/api/tickets').expect(403)).body.code).toBe('SAUT-E015');
    const shell = await session.agent.get('/api/bff/shell').expect(200);
    expect(shell.body.mustChangePassword).toBe(true);

    await session.agent.patch('/api/auth/password').set('X-XSRF-TOKEN', session.csrf).send({ currentPassword: body.tempPassword, newPassword: 'Mi-Clave-Nueva-2026!' }).expect(204);
    await session.agent.get('/api/tickets').expect(200);
    expect((await session.agent.get('/api/bff/shell').expect(200)).body.mustChangePassword).toBe(false);
    expect((await login('nuevo@ticketit.dev', body.tempPassword)).status).toBe(401);
  });

  it('restablecer contraseña: temporal nueva, cierra sus sesiones y destraba la cuenta; no sobre uno mismo', async () => {
    const admin = await login('marta@ticketit.dev');
    const victor = await login('victor@ticketit.dev');
    await victor.agent.get('/api/tickets').expect(200);

    const reset = await post(admin, `/api/users/${uuidOf('victor@ticketit.dev')}/reset-password`).expect(200);
    expect(reset.body.user.mustChangePassword).toBe(true);
    await victor.agent.get('/api/tickets').expect(401); // su sesión se cerró
    expect((await login('victor@ticketit.dev', DEV_PASSWORD)).status).toBe(401); // la anterior ya no sirve
    expect((await login('victor@ticketit.dev', reset.body.tempPassword)).status).toBe(200);

    expect((await post(admin, `/api/users/${uuidOf('marta@ticketit.dev')}/reset-password`).expect(409)).body.code).toBe('SUSR-E003');
  });

  it('restablecer TOTP: quita el autenticador y avisa a la persona', async () => {
    const admin = await login('marta@ticketit.dev');
    const ana = await login('ana@ticketit.dev');
    const setup = await post(ana, '/api/auth/totp/setup').expect(200);
    expect(setup.body.secret).toBeTruthy();
    const { totpCode, totpStep } = await import('./../src/modules/auth/session/totp.util.js');
    await post(ana, '/api/auth/totp/enable', { code: totpCode(setup.body.secret, totpStep(Date.now())) }).expect(200);
    expect((await admin.agent.get(`/api/users/${uuidOf('ana@ticketit.dev')}`).expect(200)).body.totpEnabled).toBe(true);

    const res = await post(admin, `/api/users/${uuidOf('ana@ticketit.dev')}/reset-totp`).expect(200);
    expect(res.body.totpEnabled).toBe(false);
    const notices = await (await login('ana@ticketit.dev')).agent.get('/api/notifications').expect(200);
    expect(notices.body.data.some((n: { type: string }) => n.type === 'ACCOUNT_SECURITY')).toBe(true);
  });
});
