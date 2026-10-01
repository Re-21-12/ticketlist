import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const ANA = 'ana@ticketit.dev';
const MARTA = 'marta@ticketit.dev';
const NEW_PASSWORD = 'Nueva-Clave-2026!';

interface ISession {
  agent: TestAgent;
  xsrf: string;
  sid: string;
}

/**
 * Perfil: cambio de contraseña, sesiones del usuario y avatar. Si `REDIS_URL` está definido corre contra
 * Redis real (`bun run test:redis`); si no, contra el almacén en memoria.
 */
describe('Perfil (e2e)', () => {
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

  const cookie = (res: Response, name: string): string => {
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`)) ?? '';
    return decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
  };

  async function login(email: string, password = DEV_PASSWORD): Promise<ISession> {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password }).expect(200);
    return { agent, xsrf: cookie(res, 'XSRF-TOKEN'), sid: cookie(res, 'sid') };
  }

  const patchPassword = (s: ISession, body: Record<string, unknown>) =>
    s.agent.patch('/api/auth/password').set('X-XSRF-TOKEN', s.xsrf).send(body);

  describe('Cambio de contraseña', () => {
    it('la actual incorrecta → 422 SAUT-E006', async () => {
      const ana = await login(ANA);
      const res = await patchPassword(ana, { currentPassword: 'no-es-esa-123', newPassword: NEW_PASSWORD }).expect(422);
      expect(res.body).toMatchObject({ code: 'SAUT-E006' });
    });

    it('una contraseña débil → 400 con el campo y QUÉ falta (no «inválida»)', async () => {
      const ana = await login(ANA);
      const res = await patchPassword(ana, { currentPassword: DEV_PASSWORD, newPassword: 'sololetras' }).expect(400);
      const error = res.body.errors.find((e: { path: string }) => e.path === 'newPassword');
      expect(error.pointer).toBe('#/newPassword');
      expect(error.message).toBe('Agrega: mayúscula, número, símbolo (!@#$%)');
    });

    it('igual a la actual → 422 SAUT-E007', async () => {
      const ana = await login(ANA);
      // La de desarrollo ya es válida de complejidad: se cambia primero a una fuerte y luego se repite.
      await patchPassword(ana, { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(204);
      const res = await patchPassword(ana, { currentPassword: NEW_PASSWORD, newPassword: NEW_PASSWORD }).expect(422);
      expect(res.body).toMatchObject({ code: 'SAUT-E007' });
    });

    it('éxito: la clave vieja deja de servir, la nueva sirve y la sesión actual sigue abierta', async () => {
      const ana = await login(ANA);
      await patchPassword(ana, { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(204);

      await request(app.getHttpServer()).post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(401);
      await request(app.getHttpServer()).post('/api/auth/sign-in').send({ email: ANA, password: NEW_PASSWORD }).expect(200);
      await ana.agent.get('/api/bff/shell').expect(200);
    });

    it('cierra las DEMÁS sesiones (quien tenía la clave vieja queda fuera)', async () => {
      const here = await login(ANA);
      const elsewhere = await login(ANA);
      await elsewhere.agent.get('/api/bff/shell').expect(200);

      await patchPassword(here, { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(204);

      await elsewhere.agent.get('/api/bff/shell').expect(401);
      await here.agent.get('/api/bff/shell').expect(200);
    });

    it('5 contraseñas actuales equivocadas bloquean la cuenta → 429 con Retry-After', async () => {
      const ana = await login(ANA);
      for (let i = 0; i < 5; i++) {
        await patchPassword(ana, { currentPassword: `mal-${i}-XYZ`, newPassword: NEW_PASSWORD }).expect(422);
      }
      const blocked = await patchPassword(ana, { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(429);
      expect(blocked.body).toMatchObject({ code: 'SRTL-E001' });
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('sin token CSRF → 403 y sin sesión → 401', async () => {
      const ana = await login(ANA);
      await ana.agent.patch('/api/auth/password').send({ currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD }).expect(403);
      await request(app.getHttpServer()).patch('/api/auth/password').send({}).expect(401);
    });

    it('rechaza claves extra en el body (strictObject)', async () => {
      const ana = await login(ANA);
      await patchPassword(ana, { currentPassword: DEV_PASSWORD, newPassword: NEW_PASSWORD, userUuid: 'otro' }).expect(400);
    });
  });

  describe('Sesiones', () => {
    it('lista las sesiones vivas, marca la actual y NUNCA expone el sid de la cookie', async () => {
      const first = await login(ANA);
      const second = await login(ANA);
      const res = await second.agent.get('/api/auth/sessions').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].current).toBe(true);
      expect(res.body.data.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
      expect(res.body.data[0]).toHaveProperty('ipAddress');
      expect(JSON.stringify(res.body)).not.toContain(first.sid);
      expect(JSON.stringify(res.body)).not.toContain(second.sid);
    });

    it('cada usuario ve SOLO las suyas', async () => {
      await login(ANA);
      const marta = await login(MARTA);
      const res = await marta.agent.get('/api/auth/sessions').expect(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('cerrar otra sesión → 204 y esa sesión recibe 401', async () => {
      const here = await login(ANA);
      const elsewhere = await login(ANA);
      const list = await here.agent.get('/api/auth/sessions').expect(200);
      const other = list.body.data.find((s: { current: boolean }) => !s.current);

      await here.agent.delete(`/api/auth/sessions/${other.id}`).set('X-XSRF-TOKEN', here.xsrf).expect(204);
      await elsewhere.agent.get('/api/bff/shell').expect(401);
      await here.agent.get('/api/bff/shell').expect(200);
    });

    it('la sesión actual no se cierra por aquí → 422 SSES-E001', async () => {
      const here = await login(ANA);
      const list = await here.agent.get('/api/auth/sessions').expect(200);
      const res = await here.agent.delete(`/api/auth/sessions/${list.body.data[0].id}`).set('X-XSRF-TOKEN', here.xsrf).expect(422);
      expect(res.body).toMatchObject({ code: 'SSES-E001' });
    });

    it('un id inexistente o de OTRO usuario → 404 RSES-E001 (no revela que existe)', async () => {
      const ana = await login(ANA);
      const marta = await login(MARTA);
      const martaSession = (await marta.agent.get('/api/auth/sessions').expect(200)).body.data[0];

      const own = await ana.agent.delete('/api/auth/sessions/no-existe').set('X-XSRF-TOKEN', ana.xsrf).expect(404);
      expect(own.body).toMatchObject({ code: 'RSES-E001' });
      await ana.agent.delete(`/api/auth/sessions/${martaSession.id}`).set('X-XSRF-TOKEN', ana.xsrf).expect(404);
      await marta.agent.get('/api/bff/shell').expect(200);
    });

    it('«cerrar las demás» deja solo la actual', async () => {
      const here = await login(ANA);
      const a = await login(ANA);
      const b = await login(ANA);

      await here.agent.post('/api/auth/sessions/revoke-others').set('X-XSRF-TOKEN', here.xsrf).expect(204);

      await a.agent.get('/api/bff/shell').expect(401);
      await b.agent.get('/api/bff/shell').expect(401);
      const list = await here.agent.get('/api/auth/sessions').expect(200);
      expect(list.body.data).toHaveLength(1);
    });

    it('cerrar sesión la quita de la lista', async () => {
      const here = await login(ANA);
      const other = await login(ANA);
      await other.agent.post('/api/auth/sign-out').set('X-XSRF-TOKEN', other.xsrf).expect(204);
      const list = await here.agent.get('/api/auth/sessions').expect(200);
      expect(list.body.data).toHaveLength(1);
    });
  });

  describe('Avatar', () => {
    it('guarda ícono y color, y el shell los devuelve', async () => {
      const ana = await login(ANA);
      const res = await ana.agent
        .patch('/api/users/me/avatar')
        .set('X-XSRF-TOKEN', ana.xsrf)
        .send({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' })
        .expect(200);
      expect(res.body).toEqual({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' });

      const shell = await ana.agent.get('/api/bff/shell').expect(200);
      expect(shell.body.user).toMatchObject({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' });
    });

    it('null / null vuelve a las iniciales', async () => {
      const ana = await login(ANA);
      await ana.agent.patch('/api/users/me/avatar').set('X-XSRF-TOKEN', ana.xsrf).send({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' }).expect(200);
      await ana.agent.patch('/api/users/me/avatar').set('X-XSRF-TOKEN', ana.xsrf).send({ avatarIcon: null, avatarColor: null }).expect(200);
      const shell = await ana.agent.get('/api/bff/shell').expect(200);
      expect(shell.body.user).toMatchObject({ avatarIcon: null, avatarColor: null });
    });

    it('un color o ícono fuera de la lista → 400 (no se guarda texto libre que se pinte en el DOM)', async () => {
      const ana = await login(ANA);
      const res = await ana.agent
        .patch('/api/users/me/avatar')
        .set('X-XSRF-TOKEN', ana.xsrf)
        .send({ avatarIcon: '<script>', avatarColor: 'red; background:url(x)' })
        .expect(400);
      const pointers = res.body.errors.map((e: { pointer: string }) => e.pointer);
      expect(pointers).toEqual(expect.arrayContaining(['#/avatarIcon', '#/avatarColor']));
    });

    it('cada persona edita SOLO su avatar', async () => {
      const ana = await login(ANA);
      const marta = await login(MARTA);
      await ana.agent.patch('/api/users/me/avatar').set('X-XSRF-TOKEN', ana.xsrf).send({ avatarIcon: 'pi-star', avatarColor: '#1d4ed8' }).expect(200);
      const shell = await marta.agent.get('/api/bff/shell').expect(200);
      expect(shell.body.user.avatarIcon).toBeNull();
    });
  });
});
