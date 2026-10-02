import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request, { type Response } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const TCK_001 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e01'; // titular Ana (AGENT), asignado a Ana
const TCK_002 = '6f1d7c2a-8b1e-4c7a-9f0e-1a2b3c4d5e02'; // titular Marta (ADMIN), sin asignar
const MARTA = 'marta@ticketit.dev'; // ADMIN
const MARTA_UUID = '0b8a5f6e-1c2d-4e3f-8a9b-000000000001';
const ANA = 'ana@ticketit.dev'; // AGENT
const ANA_UUID = '0b8a5f6e-1c2d-4e3f-8a9b-000000000002';
const VICTOR = 'victor@ticketit.dev'; // VIEWER

/** Sesión real: agente de supertest con cookies + header CSRF copiado de la cookie XSRF-TOKEN. */
interface ISession {
  agent: TestAgent;
  xsrf: string;
}

describe('ticketlistbe (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, loadEnv({ NODE_ENV: 'test' }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  async function login(email: string): Promise<ISession> {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email, password: DEV_PASSWORD }).expect(200);
    return { agent, xsrf: cookieValue(res, 'XSRF-TOKEN') };
  }

  function setCookies(res: Response): string[] {
    return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  }

  function cookieValue(res: Response, name: string): string {
    const cookie = setCookies(res).find((c) => c.startsWith(`${name}=`)) ?? '';
    return decodeURIComponent(cookie.split(';')[0].split('=')[1] ?? '');
  }

  /** Body de PATCH a partir de la respuesta del GET (sin campos de servidor). */
  function editable(ticket: Record<string, unknown>): Record<string, unknown> {
    const { uuid: _u, code: _c, createdAt: _ca, ownerUuid: _o, ...rest } = ticket;
    return rest;
  }

  const newTicket = { title: 'Nuevo', description: '', type: 'incident', category: 'software', priority: 'high' };

  // ── RFC 9457 ────────────────────────────────────────────────────────────
  describe('Problem Details (RFC 9457)', () => {
    it('sin sesión → 401 application/problem+json con type desreferenciable', async () => {
      const res = await api().get('/api/tickets').expect(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({
        type: '/api/problems/SAUT-E002',
        title: 'Necesitas iniciar sesión',
        status: 401,
        instance: '/api/tickets',
        code: 'SAUT-E002',
      });
      const type = await api().get(res.body.type).expect(200);
      expect(type.body).toMatchObject({ code: 'SAUT-E002', httpStatus: 401 });
    });

    it('400 de validación con errors[] y JSON Pointer (RFC 6901)', async () => {
      const { agent, xsrf } = await login(ANA);
      const res = await agent
        .post('/api/tickets')
        .set('X-XSRF-TOKEN', xsrf)
        .send({ title: 'ab', description: '', type: 'inquiry', category: 'other', priority: 'low' })
        .expect(400);
      expect(res.body.code).toBe('CVAL-E001');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          { pointer: '#/title', path: 'title', message: 'El título debe tener al menos 3 caracteres', code: 'too_small' },
          { pointer: '#/otherCategoryDetail', path: 'otherCategoryDetail', message: 'Describe la categoría', code: 'custom' },
        ]),
      );
    });
  });

  // ── Sesión stateful + cookies (RFC 6265) + CSRF ───────────────────────────
  describe('Sesión y cookies', () => {
    it('credenciales inválidas → 401 SAUT-E004 (mismo error si el correo no existe)', async () => {
      const wrong = await api().post('/api/auth/sign-in').send({ email: ANA, password: 'otra-clave' }).expect(401);
      const unknown = await api()
        .post('/api/auth/sign-in')
        .send({ email: 'nadie@x.dev', password: 'otra-clave' })
        .expect(401);
      expect(wrong.body.code).toBe('SAUT-E004');
      expect(unknown.body.code).toBe('SAUT-E004');
    });

    it('cookie sid: HttpOnly, SameSite=Lax, Path=/api, Max-Age 30 min; XSRF-TOKEN legible por JS', async () => {
      const res = await api().post('/api/auth/sign-in').send({ email: ANA, password: DEV_PASSWORD }).expect(200);
      const sid = setCookies(res).find((c) => c.startsWith('sid='))!;
      const xsrf = setCookies(res).find((c) => c.startsWith('XSRF-TOKEN='))!;
      expect(sid).toMatch(/HttpOnly/i);
      expect(sid).toMatch(/SameSite=Lax/i);
      expect(sid).toMatch(/Path=\/api/);
      // express-session emite `Expires` (no Max-Age): ~30 min desde ahora = idle timeout.
      const expires = Date.parse(/Expires=([^;]+)/i.exec(sid)![1]);
      expect(expires - Date.now()).toBeGreaterThan(29 * 60_000);
      expect(expires - Date.now()).toBeLessThanOrEqual(30 * 60_000 + 1_000);
      expect(xsrf).not.toMatch(/HttpOnly/i);
      expect(res.body.user.email).toBe(ANA);
    });

    it('mutación sin X-XSRF-TOKEN → 403 SAUT-E003', async () => {
      const { agent } = await login(ANA);
      const res = await agent.post('/api/tickets').send(newTicket).expect(403);
      expect(res.body.code).toBe('SAUT-E003');
    });

    it('sign-out destruye la sesión', async () => {
      const { agent, xsrf } = await login(ANA);
      await agent.post('/api/auth/sign-out').set('X-XSRF-TOKEN', xsrf).expect(204);
      await agent.get('/api/bff/shell').expect(401);
    });
  });

  // ── Caché HTTP (RFC 9111) + ETag / concurrencia (RFC 9110 §13) ────────────
  describe('Caché y concurrencia', () => {
    it('GET → Cache-Control private + ETag; If-None-Match → 304', async () => {
      const { agent } = await login(ANA);
      const first = await agent.get(`/api/tickets/${TCK_001}`).expect(200);
      expect(first.headers['cache-control']).toBe('private, max-age=0');
      expect(first.headers['etag']).toMatch(/^"[\w-]+"$/);
      await agent.get(`/api/tickets/${TCK_001}`).set('If-None-Match', first.headers['etag']).expect(304);
    });

    it('PATCH con If-Match vigente → 200 no-store; con el mismo If-Match ya viejo → 412 SCONC-E001', async () => {
      const { agent, xsrf } = await login(ANA);
      const current = await agent.get(`/api/tickets/${TCK_001}`).expect(200);
      const etag = current.headers['etag'];
      const body = editable(current.body);

      const ok = await agent
        .patch(`/api/tickets/${TCK_001}`)
        .set('X-XSRF-TOKEN', xsrf)
        .set('If-Match', etag)
        .send({ ...body, title: 'Primera edición' })
        .expect(200);
      expect(ok.headers['cache-control']).toBe('no-store');

      const stale = await agent
        .patch(`/api/tickets/${TCK_001}`)
        .set('X-XSRF-TOKEN', xsrf)
        .set('If-Match', etag)
        .send({ ...body, title: 'Edición con versión vieja' })
        .expect(412);
      expect(stale.body.code).toBe('SCONC-E001');
    });
  });

  // ── RBAC DB-first ───────────────────────────────────────────────────────
  describe('RBAC (role_permissions)', () => {
    it('el CLIENTE (VIEWER) registra solicitudes y ve SOLO las suyas; las ajenas responden 404', async () => {
      const { agent, xsrf } = await login(VICTOR);
      const created = await agent.post('/api/tickets').set('X-XSRF-TOKEN', xsrf).send(newTicket).expect(201);
      expect(created.body).toMatchObject({ status: 'new', requesterName: 'Víctor Lector' });
      const mine = await agent.get('/api/tickets').expect(200);
      expect(mine.body.data.map((t: { uuid: string }) => t.uuid)).toEqual([created.body.uuid]);
      await agent.get(`/api/tickets/${TCK_002}`).expect(404);
    });

    it('solo ADMIN gestiona permisos, y un cambio rige desde la siguiente request', async () => {
      const ana = await login(ANA);
      await ana.agent.get('/api/role-permissions').expect(403);

      const marta = await login(MARTA);
      const victor = await login(VICTOR);
      // Sin permiso por rol, el cliente solo tiene la regla de titular: no ve nada ajeno (404, no se revela).
      expect((await victor.agent.get('/api/tickets').expect(200)).body.meta.total).toBe(0);
      await victor.agent.get(`/api/tickets/${TCK_002}`).expect(404);

      const granted = await marta.agent
        .post('/api/role-permissions')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({ role: 'VIEWER', subject: 'Ticket', action: 'read', condition: 'NONE' })
        .expect(201);
      expect((await victor.agent.get('/api/tickets').expect(200)).body.meta.total).toBe(3);

      await marta.agent.delete(`/api/role-permissions/${granted.body.uuid}`).set('X-XSRF-TOKEN', marta.xsrf).expect(204);
      expect((await victor.agent.get('/api/tickets').expect(200)).body.meta.total).toBe(0);
      await victor.agent.get(`/api/tickets/${TCK_002}`).expect(404);
    });

    it('permiso duplicado → 409 RRPM-E002', async () => {
      const { agent, xsrf } = await login(MARTA);
      const res = await agent
        .post('/api/role-permissions')
        .set('X-XSRF-TOKEN', xsrf)
        .send({ role: 'AGENT', subject: 'Ticket', action: 'read', condition: 'NONE' })
        .expect(409);
      expect(res.body.code).toBe('RRPM-E002');
    });
  });

  // ── Titular / Alternante (ReBAC) + notificaciones ─────────────────────────
  describe('Titular / Alternante', () => {
    it('el titular concede update → la alternante edita y el titular recibe aviso; al revocar pierde el acceso', async () => {
      const ana = await login(ANA);
      const before = await ana.agent.get(`/api/tickets/${TCK_002}`).expect(200);
      await ana.agent.patch(`/api/tickets/${TCK_002}`).set('X-XSRF-TOKEN', ana.xsrf).send(editable(before.body)).expect(403);

      // Marta (titular de TCK-002) comparte con Ana, con consentimiento.
      const marta = await login(MARTA);
      const relationship = await marta.agent
        .post('/api/relationships')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({
          alternanteEmail: ANA,
          consent: true,
          grants: [{ objectType: 'Ticket', canRead: true, canUpdate: true, notifyTitular: true }],
        })
        .expect(201);
      expect(relationship.body).toMatchObject({ status: 'ACTIVE', myRole: 'TITULAR', alternanteUuid: ANA_UUID });

      // El shell de Ana ya trae la concesión proyectada como regla CASL.
      const anaShell = await ana.agent.get('/api/bff/shell').expect(200);
      expect(anaShell.body.abilityRules).toContainEqual({
        action: 'update',
        subject: 'Ticket',
        conditions: { ownerUuid: { $in: [MARTA_UUID] } },
      });
      await ana.agent
        .patch(`/api/tickets/${TCK_002}`)
        .set('X-XSRF-TOKEN', ana.xsrf)
        .send({ ...editable(before.body), title: 'Editado por la alternante' })
        .expect(200);

      const notifications = await marta.agent.get('/api/notifications').expect(200);
      expect(notifications.body.unread).toBe(1);
      expect(notifications.body.data[0]).toMatchObject({ type: 'TICKET_CHANGED_BY_ALTERNANTE', resourceUuid: TCK_002 });
      const anaNotifications = await ana.agent.get('/api/notifications').expect(200);
      expect(anaNotifications.body.data[0]).toMatchObject({ type: 'RELATIONSHIP_GRANTED' });

      // Revocar: historial conservado, acceso perdido al instante.
      await marta.agent.delete(`/api/relationships/${relationship.body.uuid}`).set('X-XSRF-TOKEN', marta.xsrf).expect(204);
      const history = await marta.agent.get('/api/relationships').expect(200);
      expect(history.body[0]).toMatchObject({ status: 'REVOKED' });
      expect(history.body[0].endedAt).not.toBeNull();
      await ana.agent
        .patch(`/api/tickets/${TCK_002}`)
        .set('X-XSRF-TOKEN', ana.xsrf)
        .send({ ...editable(before.body), title: 'Ya no debería poder' })
        .expect(403);
    });

    it('techo por rol: aunque el titular conceda update, un VIEWER no escribe', async () => {
      const marta = await login(MARTA);
      await marta.agent
        .post('/api/relationships')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({ alternanteEmail: VICTOR, consent: true, grants: [{ objectType: 'Ticket', canUpdate: true }] })
        .expect(201);
      const victor = await login(VICTOR);
      const ticket = await victor.agent.get(`/api/tickets/${TCK_002}`).expect(200);
      await victor.agent.patch(`/api/tickets/${TCK_002}`).set('X-XSRF-TOKEN', victor.xsrf).send(editable(ticket.body)).expect(403);
    });

    it('sin consentimiento → 400; consigo mismo → 422 SREL-E001; solo el titular cambia reglas → 403 SREL-E004', async () => {
      const marta = await login(MARTA);
      const noConsent = await marta.agent
        .post('/api/relationships')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({ alternanteEmail: ANA, grants: [{ objectType: 'Ticket' }] })
        .expect(400);
      expect(noConsent.body.errors[0]).toMatchObject({ path: 'consent' });

      const self = await marta.agent
        .post('/api/relationships')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({ alternanteEmail: MARTA, consent: true, grants: [{ objectType: 'Ticket' }] })
        .expect(422);
      expect(self.body.code).toBe('SREL-E001');

      const created = await marta.agent
        .post('/api/relationships')
        .set('X-XSRF-TOKEN', marta.xsrf)
        .send({ alternanteEmail: ANA, consent: true, grants: [{ objectType: 'Ticket' }] })
        .expect(201);
      const ana = await login(ANA);
      const notTitular = await ana.agent
        .patch(`/api/relationships/${created.body.uuid}/grants`)
        .set('X-XSRF-TOKEN', ana.xsrf)
        .send({ consent: true, grants: [{ objectType: 'Ticket', canUpdate: true }] })
        .expect(403);
      expect(notTitular.body.code).toBe('SREL-E004');
    });
  });

  // ── Contrato de tickets / BFF / docs ──────────────────────────────────────
  describe('Tickets, BFF y documentación', () => {
    it('BFF board: TRES columnas (los estados son variaciones de tres grandes) con sus tarjetas', async () => {
      const { agent } = await login(ANA);
      const res = await agent.get('/api/bff/board').expect(200);
      const columns = res.body.columns as { group: string; label: string; statuses: string[]; tickets: { status: string }[] }[];
      expect(columns.map((c) => [c.group, c.label])).toEqual([
        ['new', 'Nuevo'],
        ['in_attention', 'En atención'],
        ['closed', 'Cerrado'],
      ]);
      expect(columns[0]?.statuses).toEqual(['new', 'reopened']);
      expect(columns[1]?.statuses).toEqual(['assigned', 'in_progress', 'escalated', 'pending_customer']);
      expect(columns[2]?.statuses).toEqual(['resolved', 'closed']);
      // Cada tarjeta cae en la columna de SU estado: TCK-001 en atención, TCK-002 nuevo, TCK-003 cerrado.
      for (const column of columns) for (const ticket of column.tickets) expect(column.statuses).toContain(ticket.status);
      expect(columns.map((c) => c.tickets.length)).toEqual([1, 1, 1]);
    });

    it('GET /api/tickets pagina con coerción de query params', async () => {
      const { agent } = await login(ANA);
      const res = await agent.get('/api/tickets?page=1&take=2').expect(200);
      expect(res.body.meta).toEqual({ total: 3, page: 1, take: 2 });
    });

    it('POST alta rápida: defaults del schema y el creador queda como titular', async () => {
      const { agent, xsrf } = await login(ANA);
      const res = await agent.post('/api/tickets').set('X-XSRF-TOKEN', xsrf).send(newTicket).expect(201);
      expect(res.body).toMatchObject({ status: 'new', assigneeEmail: '', code: 'TCK-004', ownerUuid: ANA_UUID });
    });

    it('PATCH conserva la fecha local (sin corrimiento de día por UTC)', async () => {
      const { agent, xsrf } = await login(ANA);
      const current = (await agent.get(`/api/tickets/${TCK_001}`).expect(200)).body;
      const res = await agent
        .patch(`/api/tickets/${TCK_001}`)
        .set('X-XSRF-TOKEN', xsrf)
        .send({ ...editable(current), dueDate: '2026-12-31' })
        .expect(200);
      expect(res.body.dueDate).toBe('2026-12-31');
    });

    it('Scalar UI en /api/reference y OpenAPI con errores application/problem+json', async () => {
      const ui = await api().get('/api/reference').expect(200);
      expect(ui.text).toContain('Ticketit BFF');
      const doc = (await api().get('/api/openapi.json').expect(200)).body;
      const post = doc.paths['/api/tickets'].post;
      expect(post.requestBody.content['application/json'].schema.properties.title).toMatchObject({
        type: 'string',
        minLength: 3,
        maxLength: 120,
      });
      expect(post.responses['400'].content).toHaveProperty('application/problem+json');
    });
  });
});
