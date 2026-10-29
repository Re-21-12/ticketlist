import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/**
 * Filtro por FECHA DE REGISTRO del listado (`?createdFrom=&createdTo=`): lo que la pantalla de
 * tickets necesita para «Hoy» y para un rango. El detalle que importa es que un `createdTo` de
 * SOLO FECHA incluya el día completo, y que los dos extremos inválidos se rechazen con el mensaje
 * de validación (no se filtran en silencio).
 */
describe('Ticket: filtro por fecha de registro (e2e)', () => {
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

  async function login(email: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD }).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('XSRF-TOKEN=')) ?? '';
    const xsrf = decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
    return { get: (u: string) => agent.get(u), post: (u: string) => agent.post(u).set('X-XSRF-TOKEN', xsrf) };
  }

  const body = { title: 'Filtro por fecha', description: '', type: 'incident', category: 'email', priority: 'medium' };
  /** Día LOCAL del negocio (UTC−6) en `YYYY-MM-DD`: el filtro lee una fecha sin hora como día local, no UTC. */
  const iso = (date: Date) => new Date(date.getTime() - 6 * 3_600_000).toISOString().slice(0, 10);
  const dayOffset = (days: number) => iso(new Date(Date.now() + days * 86_400_000));

  it('«hoy» devuelve lo registrado hoy y nada de días anteriores', async () => {
    const marta = await login('marta@ticketit.dev');
    const uuid = (await marta.post('/api/tickets').send(body).expect(201)).body.uuid as string;

    const today = (await marta.get(`/api/tickets?createdFrom=${dayOffset(0)}&createdTo=${dayOffset(0)}&take=100`).expect(200)).body;
    expect(today.data.map((t: { uuid: string }) => t.uuid)).toContain(uuid);

    const yesterday = (await marta.get(`/api/tickets?createdFrom=${dayOffset(-1)}&createdTo=${dayOffset(-1)}&take=100`).expect(200)).body;
    expect(yesterday.data.map((t: { uuid: string }) => t.uuid)).not.toContain(uuid);
  });

  it('sin rango el listado NO filtra por fecha (el filtro es opcional)', async () => {
    const marta = await login('marta@ticketit.dev');
    const uuid = (await marta.post('/api/tickets').send(body).expect(201)).body.uuid as string;
    const all = (await marta.get('/api/tickets?take=100').expect(200)).body;
    expect(all.data.map((t: { uuid: string }) => t.uuid)).toContain(uuid);
  });

  it('el rango abarca varios días e incluye los dos extremos completos', async () => {
    const marta = await login('marta@ticketit.dev');
    const uuid = (await marta.post('/api/tickets').send(body).expect(201)).body.uuid as string;
    const inRange = (await marta.get(`/api/tickets?createdFrom=${dayOffset(-3)}&createdTo=${dayOffset(2)}&take=100`).expect(200)).body;
    expect(inRange.data.map((t: { uuid: string }) => t.uuid)).toContain(uuid);

    const outOfRange = (await marta.get(`/api/tickets?createdFrom=${dayOffset(-30)}&createdTo=${dayOffset(-3)}&take=100`).expect(200)).body;
    expect(outOfRange.data.map((t: { uuid: string }) => t.uuid)).not.toContain(uuid);
  });

  it('un extremo abierto sí filtra: solo `createdFrom` o solo `createdTo`', async () => {
    const marta = await login('marta@ticketit.dev');
    const uuid = (await marta.post('/api/tickets').send(body).expect(201)).body.uuid as string;
    const since = (await marta.get(`/api/tickets?createdFrom=${dayOffset(0)}&take=100`).expect(200)).body;
    expect(since.data.map((t: { uuid: string }) => t.uuid)).toContain(uuid);
    const until = (await marta.get(`/api/tickets?createdTo=${dayOffset(0)}&take=100`).expect(200)).body;
    expect(until.data.map((t: { uuid: string }) => t.uuid)).toContain(uuid); // se creó hoy
    const before = (await marta.get(`/api/tickets?createdTo=${dayOffset(-1)}&take=100`).expect(200)).body;
    expect(before.data.map((t: { uuid: string }) => t.uuid)).not.toContain(uuid);
  });

  it('el rango se puede combinar con los otros filtros (no se pisan entre sí)', async () => {
    const marta = await login('marta@ticketit.dev');
    await marta.post('/api/tickets').send(body).expect(201);
    const matched = (await marta.get(`/api/tickets?priority=medium&createdFrom=${dayOffset(0)}&createdTo=${dayOffset(0)}&take=100`).expect(200)).body;
    expect(matched.data.length).toBeGreaterThan(0);
    expect(matched.data.every((t: { priority: string }) => t.priority === 'medium')).toBe(true);

    const none = (await marta.get(`/api/tickets?priority=low&createdFrom=${dayOffset(0)}&createdTo=${dayOffset(0)}&take=100`).expect(200)).body;
    expect(none.data).toHaveLength(0);
  });

  it('final anterior a la inicial: 400 con el mensaje en el campo `createdTo`', async () => {
    const marta = await login('marta@ticketit.dev');
    const res = await marta.get(`/api/tickets?createdFrom=${dayOffset(0)}&createdTo=${dayOffset(-2)}`).expect(400);
    expect(res.body.code).toBe('CVAL-E001');
    expect(res.body.errors.some((e: { path: string[] }) => e.path.includes('createdTo'))).toBe(true);
  });

  it('un rango de más de 366 días se rechaza en vez de devolver medio catálogo', async () => {
    const marta = await login('marta@ticketit.dev');
    const res = await marta.get(`/api/tickets?createdFrom=${dayOffset(-400)}&createdTo=${dayOffset(0)}`).expect(400);
    expect(res.body.code).toBe('CVAL-E001');
    expect(res.body.errors.some((e: { message: string }) => e.message.includes('366'))).toBe(true);
  });

  it('una fecha que no es fecha: 400 (no se ignora el filtro en silencio)', async () => {
    const marta = await login('marta@ticketit.dev');
    const res = await marta.get('/api/tickets?createdFrom=ayer').expect(400);
    expect(res.body.code).toBe('CVAL-E001');
  });
});