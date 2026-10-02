import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

interface IItem {
  uuid: string;
  code: string;
  system: boolean;
}

/** Catálogos: opciones para cualquier sesión, administración solo ADMIN; lo de sistema es intocable. */
describe('Catálogos (e2e)', () => {
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
  const post = (s: TSession, url: string, body: object) => s.agent.post(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const patch = (s: TSession, url: string, body: object) => s.agent.patch(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const del = (s: TSession, url: string) => s.agent.delete(url).set('X-XSRF-TOKEN', s.csrf);

  it('cualquier sesión lee las opciones activas; administrar exige ADMIN (403 SAUT-E001)', async () => {
    const victor = await login('victor@ticketit.dev');
    const options = await victor.agent.get('/api/catalogs/ticket-priority/options').expect(200);
    expect(options.body.data.map((o: { value: string }) => o.value)).toEqual(['low', 'medium', 'high', 'critical']);
    expect((await victor.agent.get('/api/catalogs').expect(403)).body.code).toBe('SAUT-E001');
    await post(victor, '/api/catalogs', { key: 'nuevo', name: 'Nuevo' }).expect(403);
    expect((await victor.agent.get('/api/catalogs/no-existe/options').expect(404)).body.code).toBe('RCAT-E001');
  });

  it('ADMIN lista los de sistema y consulta un detalle con sus elementos', async () => {
    const admin = await login('marta@ticketit.dev');
    const list = await admin.agent.get('/api/catalogs').expect(200);
    expect(list.body.data.map((c: { key: string }) => c.key)).toEqual(
      expect.arrayContaining(['ticket-type', 'ticket-category', 'ticket-priority', 'ticket-complexity', 'ticket-status']),
    );
    const detail = await admin.agent.get('/api/catalogs/ticket-status').expect(200);
    expect(detail.body.items.map((i: IItem) => i.code)).toEqual(['new', 'assigned', 'in_progress', 'pending_customer', 'escalated', 'resolved', 'closed', 'reopened']);
    expect(detail.body.items.every((i: IItem) => i.system)).toBe(true);
  });

  it('crea un catálogo propio con elementos; solo los activos salen en las opciones', async () => {
    const admin = await login('marta@ticketit.dev');
    await post(admin, '/api/catalogs', { key: 'sedes', name: 'Sedes' }).expect(201);
    const a = (await post(admin, '/api/catalogs/sedes/items', { code: 'NORTE', label: 'Norte', order: 20 }).expect(201)).body;
    await post(admin, '/api/catalogs/sedes/items', { code: 'SUR', label: 'Sur', order: 10 }).expect(201);
    await patch(admin, `/api/catalogs/sedes/items/${a.uuid}`, { code: 'NORTE', label: 'Norte', order: 20, active: false }).expect(200);

    const options = await admin.agent.get('/api/catalogs/sedes/options').expect(200);
    expect(options.body.data).toEqual([{ value: 'SUR', label: 'Sur', icon: null, severity: null }]);

    await del(admin, '/api/catalogs/sedes').expect(204);
    await admin.agent.get('/api/catalogs/sedes').expect(404);
  });

  it('valida clave, código y campos extra; no repite claves ni códigos', async () => {
    const admin = await login('marta@ticketit.dev');
    await post(admin, '/api/catalogs', { key: 'Mala Clave', name: 'X' }).expect(400);
    await post(admin, '/api/catalogs', { key: 'ok-clave', name: 'Ok', extra: 1 }).expect(400);
    expect((await post(admin, '/api/catalogs', { key: 'ticket-status', name: 'Dup' }).expect(409)).body.code).toBe('RCAT-E005');

    await post(admin, '/api/catalogs', { key: 'tipos', name: 'Tipos' }).expect(201);
    await post(admin, '/api/catalogs/tipos/items', { code: '1mal', label: 'x' }).expect(400);
    await post(admin, '/api/catalogs/tipos/items', { code: 'A', label: 'Uno' }).expect(201);
    expect((await post(admin, '/api/catalogs/tipos/items', { code: 'a', label: 'Otra' }).expect(409)).body.code).toBe('RCAT-E003');
  });

  it('lo de sistema conserva código y estado, y no se elimina (RCAT-E004); la etiqueta sí cambia', async () => {
    const admin = await login('marta@ticketit.dev');
    const detail = await admin.agent.get('/api/catalogs/ticket-category').expect(200);
    const bug = detail.body.items.find((i: IItem) => i.code === 'hardware') as IItem;
    const url = `/api/catalogs/ticket-category/items/${bug.uuid}`;

    expect((await patch(admin, url, { code: 'defecto', label: 'Error', order: 10, active: true }).expect(409)).body.code).toBe('RCAT-E004');
    expect((await patch(admin, url, { code: 'hardware', label: 'Equipos', order: 10, active: false }).expect(409)).body.code).toBe('RCAT-E004');
    expect((await del(admin, url).expect(409)).body.code).toBe('RCAT-E004');
    expect((await del(admin, '/api/catalogs/ticket-category').expect(409)).body.code).toBe('RCAT-E004');

    const renamed = await patch(admin, url, { code: 'hardware', label: 'Equipos de cómputo', order: 5, active: true }).expect(200);
    expect(renamed.body).toMatchObject({ label: 'Equipos de cómputo', order: 5, system: true });
  });

  it('los elementos traen ícono y color (insignias); se administran sin tocar el código', async () => {
    const admin = await login('marta@ticketit.dev');
    const detail = await admin.agent.get('/api/catalogs/ticket-priority').expect(200);
    const critical = detail.body.items.find((i: IItem & { icon: string; severity: string }) => i.code === 'critical');
    expect(critical).toMatchObject({ icon: 'pi-exclamation-triangle', severity: 'danger' });

    await patch(admin, `/api/catalogs/ticket-priority/items/${critical.uuid}`, { code: 'critical', label: 'Urgente', order: 40, active: true, icon: 'pi-bolt', severity: 'contrast' }).expect(200);
    const options = await admin.agent.get('/api/catalogs/ticket-priority/options').expect(200);
    expect(options.body.data.find((o: { value: string }) => o.value === 'critical')).toEqual({ value: 'critical', label: 'Urgente', icon: 'pi-bolt', severity: 'contrast' });

    // Ícono y color son de formato cerrado.
    await patch(admin, `/api/catalogs/ticket-priority/items/${critical.uuid}`, { code: 'critical', label: 'Urgente', order: 40, active: true, icon: '<svg>', severity: 'danger' }).expect(400);
    await patch(admin, `/api/catalogs/ticket-priority/items/${critical.uuid}`, { code: 'critical', label: 'Urgente', order: 40, active: true, icon: 'pi-bolt', severity: 'rosado' }).expect(400);
  });

  it('un elemento inexistente da 404 RCAT-E002', async () => {
    const admin = await login('marta@ticketit.dev');
    const res = await patch(admin, '/api/catalogs/ticket-status/items/00000000-0000-4000-8000-000000000000', {
      code: 'x',
      label: 'x',
    }).expect(404);
    expect(res.body.code).toBe('RCAT-E002');
  });
});
