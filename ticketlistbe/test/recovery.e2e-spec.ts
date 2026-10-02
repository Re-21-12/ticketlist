import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { LogMailService } from './../src/core/mail/log-mail.service.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const ANA = 'ana@ticketit.dev';
const NEW_USER = { name: 'Nora Nueva', email: 'nora@ticketit.dev', password: 'Clave-Nueva-2026!' };
const OTHER_PASSWORD = 'Otra-Clave-2027!';

/** Alta, verificación de correo, recuperación de contraseña y límite de intentos de login. */
describe('Cuenta: alta y recuperación (e2e)', () => {
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
  const tokenOf = (devUrl: string): string => new URL(devUrl).searchParams.get('token') as string;
  const signIn = (email: string, password: string) => api().post('/api/auth/sign-in').send({ email, password });

  // Sin `async`: debe devolver el objeto de supertest (encadenable con `.expect`), no una promesa.
  const signUp = (user = NEW_USER) => api().post('/api/auth/sign-up').send(user);

  /** Sin confirmación por correo: el alta ya deja la cuenta lista para entrar. */
  async function signUpAndVerify(user = NEW_USER) {
    await signUp(user).expect(201);
  }

  describe('Alta de cuenta', () => {
    it('201 SIN correo de confirmación ni enlace: la cuenta nace activa y entra de inmediato', async () => {
      const outboxBefore = app.get(LogMailService).outbox.length;
      const res = await signUp().expect(201);
      expect(res.body.message).toContain('Ya puedes iniciar sesión');
      expect(res.body.devUrl).toBeUndefined();
      expect(app.get(LogMailService).outbox.length).toBe(outboxBefore); // no sale ningún correo
      await signIn(NEW_USER.email, NEW_USER.password).expect(200);
    });

    it('con la contraseña equivocada o una cuenta inexistente la respuesta es la misma (no se enumera)', async () => {
      await signUp().expect(201);
      const wrong = await signIn(NEW_USER.email, 'Equivocada-1!').expect(401);
      const unknown = await signIn('nadie@ticketit.dev', 'Equivocada-1!').expect(401);
      expect(wrong.body.code).toBe('SAUT-E004');
      expect(unknown.body.code).toBe('SAUT-E004');
    });

    it('el registro público SIEMPRE nace con el rol de menor privilegio (VIEWER)', async () => {
      await signUpAndVerify();
      const res = await signIn(NEW_USER.email, NEW_USER.password).expect(200);
      expect(res.body.user).toMatchObject({ email: NEW_USER.email, role: 'VIEWER' });
    });

    it('no se puede elegir el rol al registrarse (asignación masiva) → 400', async () => {
      const res = await api().post('/api/auth/sign-up').send({ ...NEW_USER, role: 'ADMIN' }).expect(400);
      expect(res.body.code).toBe('CVAL-E001');
    });

    it('contraseña débil → 400 con QUÉ falta; correo repetido → 409 SUSR-E001', async () => {
      const weak = await signUp({ ...NEW_USER, password: 'sololetras' }).expect(400);
      const error = weak.body.errors.find((e: { path: string }) => e.path === 'password');
      expect(error.message).toBe('Agrega: mayúscula, número, símbolo (!@#$%)');

      await signUp().expect(201);
      const dup = await signUp().expect(409);
      expect(dup.body.code).toBe('SUSR-E001');
      // El correo se normaliza: mayúsculas no esquivan la unicidad.
      await signUp({ ...NEW_USER, email: 'NORA@Ticketit.dev' }).expect(409);
    });

    it('nombre demasiado corto → 400 en el campo name', async () => {
      const res = await signUp({ ...NEW_USER, name: 'ab' }).expect(400);
      expect(res.body.errors.some((e: { pointer: string }) => e.pointer === '#/name')).toBe(true);
    });
  });

  describe('Verificar correo (ya no se exige)', () => {
    it('reenviar no hace nada: mismo mensaje exista o no la cuenta y nunca hay enlace (nadie queda sin verificar)', async () => {
      await signUp().expect(201);
      const known = await api().post('/api/auth/resend-verification').send({ email: NEW_USER.email }).expect(200);
      const unknown = await api().post('/api/auth/resend-verification').send({ email: 'nadie@ticketit.dev' }).expect(200);
      expect(known.body.message).toBe(unknown.body.message);
      expect(known.body.devUrl).toBeUndefined();
      expect(unknown.body.devUrl).toBeUndefined();
    });

    it('un token de verificación inventado → 400 SAUT-E009; basura que ni parece token → 400 CVAL-E001', async () => {
      const fake = await api().post('/api/auth/verify-email').send({ token: 'a'.repeat(43) }).expect(400);
      expect(fake.body.code).toBe('SAUT-E009');
      const junk = await api().post('/api/auth/verify-email').send({ token: '<script>' }).expect(400);
      expect(junk.body.code).toBe('CVAL-E001');
    });
  });

  describe('Olvidé mi contraseña', () => {
    it('anti-enumeración: la MISMA respuesta exista o no el correo', async () => {
      const known = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      const unknown = await api().post('/api/auth/forgot-password').send({ email: 'nadie@ticketit.dev' }).expect(200);
      expect(known.body.message).toBe(unknown.body.message);
      expect(unknown.body.devUrl).toBeUndefined();
      expect(known.body.devUrl).toMatch(/\/reset-password\?token=/);
      expect(app.get(LogMailService).outbox.filter((m) => m.to === 'nadie@ticketit.dev')).toHaveLength(0);
    });

    it('el enlace restablece: la clave vieja deja de servir y la nueva entra', async () => {
      const forgot = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      await api().post('/api/auth/reset-password').send({ token: tokenOf(forgot.body.devUrl), newPassword: OTHER_PASSWORD }).expect(204);

      await signIn(ANA, DEV_PASSWORD).expect(401);
      await signIn(ANA, OTHER_PASSWORD).expect(200);
    });

    it('cierra TODAS las sesiones abiertas de la cuenta (quizá no eran de quien lo pidió)', async () => {
      const open = request.agent(app.getHttpServer());
      await open.post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(200);
      await open.get('/api/bff/shell').expect(200);

      const forgot = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      await api().post('/api/auth/reset-password').send({ token: tokenOf(forgot.body.devUrl), newPassword: OTHER_PASSWORD }).expect(204);

      await open.get('/api/bff/shell').expect(401);
    });

    it('el token es de UN solo uso y vence con el primero', async () => {
      const forgot = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      const token = tokenOf(forgot.body.devUrl);
      await api().post('/api/auth/reset-password').send({ token, newPassword: OTHER_PASSWORD }).expect(204);
      const reused = await api().post('/api/auth/reset-password').send({ token, newPassword: 'Tercera-Clave-3!' }).expect(400);
      expect(reused.body.code).toBe('SAUT-E009');
    });

    it('una contraseña débil NO consume el token: se puede corregir y reintentar', async () => {
      const forgot = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      const token = tokenOf(forgot.body.devUrl);
      const weak = await api().post('/api/auth/reset-password').send({ token, newPassword: 'sololetras' }).expect(400);
      expect(weak.body.code).toBe('CVAL-E001');
      await api().post('/api/auth/reset-password').send({ token, newPassword: OTHER_PASSWORD }).expect(204);
    });

    it('restablecer prueba que controla el correo: una cuenta sin verificar queda verificada', async () => {
      await signUp().expect(201);
      const forgot = await api().post('/api/auth/forgot-password').send({ email: NEW_USER.email }).expect(200);
      await api().post('/api/auth/reset-password').send({ token: tokenOf(forgot.body.devUrl), newPassword: OTHER_PASSWORD }).expect(204);
      await signIn(NEW_USER.email, OTHER_PASSWORD).expect(200);
    });

    it('se limita por correo: la 6.ª solicitud en 15 min → 429', async () => {
      for (let i = 0; i < 5; i++) await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(200);
      const blocked = await api().post('/api/auth/forgot-password').send({ email: ANA }).expect(429);
      expect(blocked.body.code).toBe('SRTL-E001');
    });
  });

  describe('Límite de intentos de login y bloqueo de la cuenta', () => {
    it('5 fallos SEGUIDOS bloquean la cuenta: 423 SAUT-E014 con el contacto de los administradores, aunque luego se acierte', async () => {
      for (let i = 0; i < 4; i++) await signIn(ANA, `Mala-${i}-Clave!`).expect(401);
      const locking = await signIn(ANA, 'Mala-5-Clave!').expect(423); // el quinto intento la bloquea
      expect(locking.body.code).toBe('SAUT-E014');
      expect(locking.body.context.contacts).toEqual(expect.arrayContaining([{ name: 'Marta Admin', email: 'marta@ticketit.dev' }]));

      // Con la contraseña CORRECTA sigue bloqueada: solo un administrador la desbloquea.
      expect((await signIn(ANA, DEV_PASSWORD).expect(423)).body.code).toBe('SAUT-E014');
      // Otra cuenta no se afecta.
      await signIn('marta@ticketit.dev', DEV_PASSWORD).expect(200);
    });

    it('un acierto reinicia el contador (los fallos deben ser SEGUIDOS)', async () => {
      for (let i = 0; i < 4; i++) await signIn(ANA, `Mala-${i}-Clave!`).expect(401);
      await signIn(ANA, DEV_PASSWORD).expect(200);
      for (let i = 0; i < 4; i++) await signIn(ANA, `Mala-${i}-Clave!`).expect(401);
      await signIn(ANA, DEV_PASSWORD).expect(200);
    });

    it('una cuenta bloqueada tampoco se recupera con el segundo factor', async () => {
      for (let i = 0; i < 5; i++) await signIn(ANA, `Mala-${i}-Clave!`);
      const res = await api().post('/api/auth/recover-password').send({ method: 'current_password', email: ANA, currentPassword: DEV_PASSWORD, newPassword: 'Nueva-Clave-2026!' }).expect(401);
      expect(res.body.code).toBe('SAUT-E010');
    });

    it('cuenta inexistente: nunca se bloquea, pero el límite por correo (10 en 15 min) sigue frenando (429)', async () => {
      for (let i = 0; i < 10; i++) await signIn('fantasma@ticketit.dev', 'Mala-Clave-1!').expect(401);
      const blocked = await signIn('fantasma@ticketit.dev', 'Mala-Clave-1!').expect(429);
      expect(blocked.body.code).toBe('SRTL-E001');
    });
  });
});
