import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/**
 * Permisos sobre tickets por ROL (ReBAC + ABAC + papel en el ticket):
 *  - Cliente: crea y EDITA lo suyo; no elimina, no comparte, no asigna ni fija complejidad.
 *  - Soporte (agente): atiende, pide información y resuelve lo asignado; no escala ni elimina.
 *  - Supervisor: asigna, ESCALA y pide información; no atiende ni resuelve; no elimina.
 *  - Administrador: todo, y es el ÚNICO que elimina.
 *  - Auditor: solo lectura de todo.
 */
describe('Permisos de tickets por rol (e2e)', () => {
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
  const post = (s: TSession, url: string, body: object = {}) => s.agent.post(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const patch = (s: TSession, url: string, body: object) => s.agent.patch(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const del = (s: TSession, url: string) => s.agent.delete(url).set('X-XSRF-TOKEN', s.csrf);

  const base = { title: 'No abre el portal', description: '', type: 'incident', category: 'software', priority: 'medium', estimateHours: null, dueDate: null, notifyReporter: true };

  /** Un ticket de Víctor (cliente) asignado a Ana (soporte). */
  async function assignedTicket() {
    const [victor, ana, sergio] = await Promise.all([login('victor@ticketit.dev'), login('ana@ticketit.dev'), login('sergio@ticketit.dev')]);
    const created = (await post(victor, '/api/tickets', base).expect(201)).body as { uuid: string };
    await post(sergio, `/api/tickets/${created.uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(200);
    return { victor, ana, sergio, uuid: created.uuid };
  }
  const editable = (ticket: Record<string, unknown>) => ({
    title: ticket['title'],
    description: ticket['description'],
    type: ticket['type'],
    category: ticket['category'],
    priority: ticket['priority'],
    assigneeEmail: ticket['assigneeEmail'],
    estimateHours: ticket['estimateHours'],
    dueDate: ticket['dueDate'],
    notifyReporter: ticket['notifyReporter'],
  });

  describe('cliente', () => {
    it('crea y edita lo SUYO (título, tipo, categoría, urgencia) pero no asigna, ni estima, ni fija la complejidad', async () => {
      const victor = await login('victor@ticketit.dev');
      const created = await post(victor, '/api/tickets', { ...base, assigneeEmail: 'ana@ticketit.dev', complexity: 'complex', estimateHours: 8 }).expect(201);
      // Lo que es del equipo se ignora al crear: nace «Nuevo», sin responsable ni complejidad.
      expect(created.body).toMatchObject({ status: 'new', assigneeEmail: '', complexity: null, estimateHours: null });

      const edited = await patch(victor, `/api/tickets/${created.body.uuid}`, {
        ...editable(created.body),
        title: 'Título corregido',
        priority: 'high',
        assigneeEmail: 'luis@ticketit.dev',
        complexity: 'simple',
        estimateHours: 3,
      }).expect(200);
      expect(edited.body).toMatchObject({ title: 'Título corregido', priority: 'high', assigneeEmail: '', complexity: null, estimateHours: null });
    });

    it('NO elimina (ni su propio ticket), no restaura, no comparte ni asigna', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = (await post(victor, '/api/tickets', base).expect(201)).body as { uuid: string };
      expect((await del(victor, `/api/tickets/${uuid}`).expect(403)).body.code).toBe('SAUT-E001');
      // Restaurar tampoco: lo borra el administrador y el solicitante no lo puede devolver.
      const marta = await login('marta@ticketit.dev');
      await del(marta, `/api/tickets/${uuid}`).expect(204);
      await patch(victor, `/api/tickets/${uuid}/restore`, {}).expect(403);
      await patch(marta, `/api/tickets/${uuid}/restore`, {}).expect(204);
      // No manipula los accesos: ni crear relaciones ni verlas como titular.
      await post(victor, '/api/relationships', {
        alternanteEmail: 'ana@ticketit.dev',
        grants: [{ objectType: 'Ticket', canRead: true, canUpdate: true, notifyTitular: true }],
        consent: true,
      }).expect(403);
      await post(victor, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(403);
    });

    it('sus reglas no incluyen eliminar ni administrar relaciones (lo que recibe el front)', async () => {
      const victor = await login('victor@ticketit.dev');
      const rules = (await victor.agent.get('/api/bff/shell').expect(200)).body.abilityRules as { action: string; subject: string }[];
      const has = (action: string, subject: string) => rules.some((r) => r.action === action && r.subject === subject);
      expect(has('create', 'Ticket')).toBe(true);
      expect(has('update', 'Ticket')).toBe(true);
      expect(has('delete', 'Ticket')).toBe(false);
      expect(has('restore', 'Ticket')).toBe(false);
      expect(has('create', 'Relationship')).toBe(false);
    });
  });

  describe('soporte (agente)', () => {
    it('atiende, pide información al cliente y resuelve lo asignado; fija la complejidad', async () => {
      const { ana, uuid } = await assignedTicket();
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'pending_customer', note: '¿Desde cuándo?' }).expect(200);
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);

      const current = (await ana.agent.get(`/api/tickets/${uuid}`).expect(200)).body;
      const classified = await patch(ana, `/api/tickets/${uuid}`, { ...editable(current), complexity: 'moderate', estimateHours: 4 }).expect(200);
      expect(classified.body).toMatchObject({ complexity: 'moderate', estimateHours: 4 });
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Listo.' }).expect(200);
    });

    it('NO escala (409) ni elimina (403)', async () => {
      const { ana, uuid } = await assignedTicket();
      expect((await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'escalated' }).expect(409)).body.code).toBe('STCK-E001');
      expect((await del(ana, `/api/tickets/${uuid}`).expect(403)).body.code).toBe('SAUT-E001');
    });

    it('no atiende lo que NO tiene asignado', async () => {
      const { uuid } = await assignedTicket();
      const luis = await login('luis@ticketit.dev');
      await post(luis, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(403);
    });
  });

  describe('supervisor', () => {
    it('asigna, ESCALA y pide información; el escalado vuelve a soporte', async () => {
      const { ana, sergio, uuid } = await assignedTicket();
      await post(sergio, `/api/tickets/${uuid}/transitions`, { to: 'pending_customer', note: 'Falta el error exacto.' }).expect(200);
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);
      const escalated = await post(sergio, `/api/tickets/${uuid}/transitions`, { to: 'escalated', note: 'Requiere N2.' }).expect(200);
      expect(escalated.body.status).toBe('escalated');
      await post(sergio, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);
      await post(sergio, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'luis@ticketit.dev' }).expect(200);
    });

    it('NO atiende ni resuelve (409) y tampoco elimina (403)', async () => {
      const { sergio, uuid } = await assignedTicket();
      expect((await post(sergio, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(409)).body.code).toBe('STCK-E001');
      expect((await post(sergio, `/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Hecho' }).expect(409)).body.code).toBe('STCK-E001');
      expect((await del(sergio, `/api/tickets/${uuid}`).expect(403)).body.code).toBe('SAUT-E001');
    });

    it('lo que le ofrece el servidor (nextStatuses) coincide: solo escalar y pedir información', async () => {
      const { sergio, uuid } = await assignedTicket();
      const view = (await sergio.agent.get(`/api/tickets/${uuid}`).expect(200)).body;
      expect(view.nextStatuses.toSorted()).toEqual(['escalated', 'pending_customer']);
    });
  });

  describe('administrador', () => {
    it('elimina y restaura (es el ÚNICO que elimina) y puede mover cualquier ticket', async () => {
      const { uuid } = await assignedTicket();
      const marta = await login('marta@ticketit.dev');
      await post(marta, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(200);
      await del(marta, `/api/tickets/${uuid}`).expect(204);
      await marta.agent.get(`/api/tickets/${uuid}`).expect(410);
      await patch(marta, `/api/tickets/${uuid}/restore`, {}).expect(204);
      await marta.agent.get(`/api/tickets/${uuid}`).expect(200);
    });
  });

  describe('auditor', () => {
    it('LEE todo (tickets, notas internas, historial, métricas, auditoría) y no modifica nada', async () => {
      const { ana, uuid } = await assignedTicket();
      await post(ana, `/api/tickets/${uuid}/comments`, { body: 'Nota del equipo', internal: true }).expect(201);
      const aurora = await login('aurora@ticketit.dev');

      expect((await aurora.agent.get('/api/tickets').expect(200)).body.meta.total).toBeGreaterThanOrEqual(4);
      expect((await aurora.agent.get(`/api/tickets/${uuid}`).expect(200)).body.nextStatuses).toEqual([]);
      const events = (await aurora.agent.get(`/api/tickets/${uuid}/events`).expect(200)).body.data as { body: string | null }[];
      expect(events.some((e) => e.body === 'Nota del equipo')).toBe(true);
      await aurora.agent.get('/api/metrics/summary').expect(200);
      await aurora.agent.get('/api/audit-logs').expect(200);

      await post(aurora, '/api/tickets', base).expect(403);
      await post(aurora, `/api/tickets/${uuid}/comments`, { body: 'hola' }).expect(403);
      await post(aurora, `/api/tickets/${uuid}/transitions`, { to: 'in_progress' }).expect(403);
      await post(aurora, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'luis@ticketit.dev' }).expect(403);
      await del(aurora, `/api/tickets/${uuid}`).expect(403);
      const current = (await aurora.agent.get(`/api/tickets/${uuid}`).expect(200)).body;
      await patch(aurora, `/api/tickets/${uuid}`, { ...editable(current), title: 'Cambiado' }).expect(403);
      await aurora.agent.get('/api/role-permissions').expect(403);
      await aurora.agent.get('/api/menu-items').expect(403);
    });
  });

  describe('compartir (ReBAC)', () => {
    const grants = [{ objectType: 'Ticket', canRead: true, canUpdate: true, notifyTitular: true }];

    it('quien comparte da leer/editar, NUNCA eliminar: el alternante no borra aunque pueda editar', async () => {
      const ana = await login('ana@ticketit.dev');
      const luis = await login('luis@ticketit.dev');
      const { uuid } = (await post(ana, '/api/tickets', base).expect(201)).body as { uuid: string };
      await post(ana, '/api/relationships', { alternanteEmail: 'luis@ticketit.dev', grants, consent: true }).expect(201);

      const rules = (await luis.agent.get('/api/bff/shell').expect(200)).body.abilityRules as { action: string; subject: string; conditions?: object }[];
      expect(rules.some((r) => r.action === 'update' && JSON.stringify(r.conditions ?? {}).includes('$in'))).toBe(true);
      expect(rules.some((r) => r.action === 'delete' && JSON.stringify(r.conditions ?? {}).includes('$in'))).toBe(false);
      expect((await del(luis, `/api/tickets/${uuid}`).expect(403)).body.code).toBe('SAUT-E001');
    });

    it('un titular de soporte comparte lo suyo; el auditor y el cliente no', async () => {
      const ana = await login('ana@ticketit.dev');
      await post(ana, '/api/relationships', { alternanteEmail: 'luis@ticketit.dev', grants, consent: true }).expect(201);
      for (const email of ['aurora@ticketit.dev', 'victor@ticketit.dev']) {
        const other = await login(email);
        await post(other, '/api/relationships', { alternanteEmail: 'luis@ticketit.dev', grants, consent: true }).expect(403);
      }
    });
  });
});
