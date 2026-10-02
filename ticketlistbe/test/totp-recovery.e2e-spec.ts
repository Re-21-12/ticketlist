import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { totpCode, totpStep } from './../src/modules/auth/session/totp.util.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const ANA = 'ana@ticketit.dev';
const NEW_PASSWORD = 'Nueva-Clave-2026!';

/** Recuperar la contraseña SIN el correo: con el código del autenticador (TOTP) o con la contraseña actual. */
describe('Recuperación con segundo factor (e2e)', () => {
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
  const signIn = (email: string, password: string) => api().post('/api/auth/sign-in').send({ email, password });
  const recover = (body: object) => api().post('/api/auth/recover-password').send(body);

  const cookie = (res: { headers: Record<string, unknown> }, name: string): string => {
    const raw = ([] as string[]).concat((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith(`${name}=`)) ?? '';
    return decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
  };

  /** Sesión de Ana con el token CSRF ya puesto en cada mutación (los guards globales lo exigen). */
  async function login() {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(200);
    const xsrf = cookie(res, 'XSRF-TOKEN');
    return { get: (url: string) => agent.get(url), post: (url: string) => agent.post(url).set('X-XSRF-TOKEN', xsrf) };
  }

  /** Activa el autenticador de Ana y devuelve su secreto y la sesión abierta. */
  async function enableTotp() {
    const session = await login();
    expect((await session.get('/api/auth/totp').expect(200)).body).toEqual({ enabled: false });
    const setup = await session.post('/api/auth/totp/setup').expect(200);
    expect(setup.body.otpauthUrl).toContain(`secret=${setup.body.secret}`);
    await session.post('/api/auth/totp/enable').send({ code: totpCode(setup.body.secret, totpStep(Date.now())) }).expect(204);
    expect((await session.get('/api/auth/totp').expect(200)).body).toEqual({ enabled: true });
    return { secret: setup.body.secret as string, session };
  }

  /** El código con que se activó ya se usó: para recuperar se pide el SIGUIENTE paso (±1 paso es válido). */
  const nextCode = (secret: string) => totpCode(secret, totpStep(Date.now()) + 1);

  describe('Autenticador (alta, confirmación y baja)', () => {
    it('hay que confirmar con un código: sin setup 409 SAUT-E012; código malo 422 SAUT-E011; mal formado 400', async () => {
      const session = await login();
      expect((await session.post('/api/auth/totp/enable').send({ code: '123456' }).expect(409)).body.code).toBe('SAUT-E012');
      await session.post('/api/auth/totp/setup').expect(200);
      expect((await session.post('/api/auth/totp/enable').send({ code: '000000' }).expect(422)).body.code).toBe('SAUT-E011');
      expect((await session.post('/api/auth/totp/enable').send({ code: '12' }).expect(400)).body.code).toBe('CVAL-E001');
      expect((await session.get('/api/auth/totp').expect(200)).body.enabled).toBe(false); // sin confirmar no protege nada
    });

    it('activo: no se vuelve a configurar (409 SAUT-E013) y desactivarlo exige la contraseña actual', async () => {
      const { session } = await enableTotp();
      expect((await session.post('/api/auth/totp/setup').expect(409)).body.code).toBe('SAUT-E013');
      expect((await session.post('/api/auth/totp/disable').send({ currentPassword: 'Equivocada-1!' }).expect(422)).body.code).toBe('SAUT-E006');
      await session.post('/api/auth/totp/disable').send({ currentPassword: DEV_PASSWORD }).expect(204);
      expect((await session.get('/api/auth/totp').expect(200)).body.enabled).toBe(false);
    });

    it('sin sesión no se toca (401)', async () => {
      await api().get('/api/auth/totp').expect(401);
      await api().post('/api/auth/totp/setup').expect(401);
    });
  });

  describe('POST /api/auth/recover-password', () => {
    it('con el código TOTP: elige su nueva contraseña, la vieja deja de servir y las sesiones se cierran', async () => {
      const { secret, session } = await enableTotp();
      await recover({ method: 'totp', email: ANA, code: nextCode(secret), newPassword: NEW_PASSWORD }).expect(204);
      await signIn(ANA, DEV_PASSWORD).expect(401);
      await signIn(ANA, NEW_PASSWORD).expect(200);
      await session.get('/api/bff/shell').expect(401); // la sesión anterior se cerró
    });

    it('un código TOTP no se reutiliza (anti-replay)', async () => {
      const { secret } = await enableTotp();
      const code = nextCode(secret);
      await recover({ method: 'totp', email: ANA, code, newPassword: NEW_PASSWORD }).expect(204);
      const again = await recover({ method: 'totp', email: ANA, code, newPassword: 'Otra-Clave-2027!' }).expect(401);
      expect(again.body.code).toBe('SAUT-E010');
    });

    it('con la contraseña actual: cambia a una nueva; igual a la actual 422; mal 401', async () => {
      const bad = await recover({ method: 'current_password', email: ANA, currentPassword: 'Equivocada-1!', newPassword: NEW_PASSWORD }).expect(401);
      expect(bad.body.code).toBe('SAUT-E010');
      await recover({ method: 'current_password', email: ANA, currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(204);
      await signIn(ANA, NEW_PASSWORD).expect(200);
      // La contraseña de desarrollo es débil: la regla «distinta a la actual» se prueba ya con una fuerte.
      const same = await recover({ method: 'current_password', email: ANA, currentPassword: NEW_PASSWORD, newPassword: NEW_PASSWORD }).expect(422);
      expect(same.body.code).toBe('SAUT-E007');
    });

    it('anti-enumeración: cuenta inexistente, sin autenticador o código malo dan EXACTAMENTE la misma respuesta', async () => {
      const send = (email: string) => recover({ method: 'totp', email, code: '123456', newPassword: NEW_PASSWORD });
      const unknown = await send('nadie@ticketit.dev').expect(401);
      const noTotp = await send(ANA).expect(401); // Ana existe pero no activó el autenticador
      expect(unknown.body.code).toBe('SAUT-E010');
      expect(noTotp.body.code).toBe('SAUT-E010');
      expect(unknown.body.title).toBe(noTotp.body.title);
    });

    it('validación: código mal formado, contraseña débil o método desconocido → 400', async () => {
      const { secret } = await enableTotp();
      await recover({ method: 'totp', email: ANA, code: '12', newPassword: NEW_PASSWORD }).expect(400);
      await recover({ method: 'totp', email: ANA, code: nextCode(secret), newPassword: 'debil' }).expect(400);
      await recover({ method: 'otro', email: ANA }).expect(400);
    });

    it('5 intentos fallidos bloquean la cuenta (429 SRTL-E001), incluso con el código correcto', async () => {
      const { secret } = await enableTotp();
      for (let i = 0; i < 5; i++) {
        await recover({ method: 'totp', email: ANA, code: '000000', newPassword: NEW_PASSWORD }).expect(401);
      }
      const blocked = await recover({ method: 'totp', email: ANA, code: nextCode(secret), newPassword: NEW_PASSWORD }).expect(429);
      expect(blocked.body.code).toBe('SRTL-E001');
    });
  });
});
