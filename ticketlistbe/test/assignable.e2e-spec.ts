import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** «Asignado a»: el personal disponible sale del backend (no es texto libre). */
describe('Personal asignable (e2e)', () => {
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
    await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD }).expect(200);
    return agent;
  };

  it('lista a ADMIN y AGENT por nombre; un VIEWER no es asignable', async () => {
    const ana = await login('ana@ticketit.dev');
    const res = await ana.get('/api/users/assignable').expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([
      'ana@ticketit.dev',
      'luis@ticketit.dev',
      'marta@ticketit.dev',
    ]);
    expect(res.body.data.every((u: { role: string }) => u.role !== 'VIEWER')).toBe(true);
  });

  it('devuelve SOLO lo mínimo (nada de hashes, avatar ni estado de verificación)', async () => {
    const ana = await login('ana@ticketit.dev');
    const res = await ana.get('/api/users/assignable').expect(200);
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['email', 'name', 'role', 'uuid']);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash|salt|avatar|verified/i);
  });

  it('una cuenta nueva (nace VIEWER y verificada) no es asignable hasta que un admin le suba el rol', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up')
      .send({ name: 'Nora Nueva', email: 'nora@ticketit.dev', password: 'Clave-Nueva-2026!' })
      .expect(201);
    const ana = await login('ana@ticketit.dev');
    const list = await ana.get('/api/users/assignable').expect(200);
    expect(list.body.data.map((u: { email: string }) => u.email)).not.toContain('nora@ticketit.dev');
  });

  it('sin sesión → 401; un VIEWER (puede LEER tickets) → 200', async () => {
    await request(app.getHttpServer()).get('/api/users/assignable').expect(401);
    const victor = await login('victor@ticketit.dev');
    await victor.get('/api/users/assignable').expect(200);
  });
});
