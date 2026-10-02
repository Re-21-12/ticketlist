import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** Métricas FCR / SLA / CSAT: acceso por rol, período, fórmulas sobre datos reales y solo lectura. */
describe('Métricas (e2e)', () => {
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

  /** Solo lo creado en esta prueba: los 3 tickets sembrados son de septiembre. */
  const since = () => `from=${encodeURIComponent(new Date(Date.now() - 3_600_000).toISOString())}`;

  const base = { title: 'Fallo de acceso', description: '', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: 'ana@ticketit.dev', estimateHours: null, dueDate: null, notifyReporter: true };

  /** Un ticket de Víctor para Ana: `replies` respuestas públicas y, si `resolve`, resuelto (y cerrado si `close`). */
  async function scenario(replies: number, options: { resolve?: boolean; close?: boolean; category?: string; score?: number; comment?: string } = {}) {
    const victor = await login('victor@ticketit.dev');
    const ana = await login('ana@ticketit.dev');
    const { assigneeEmail, ...request } = base;
    const created = (await post(victor, '/api/tickets', { ...request, category: options.category ?? 'access' }).expect(201)).body;
    // El cliente no asigna: lo hace el supervisor.
    const sergio = await login('sergio@ticketit.dev');
    await post(sergio, `/api/tickets/${created.uuid}/assign`, { assigneeEmail }).expect(200);
    for (let i = 0; i < replies; i++) await post(ana, `/api/tickets/${created.uuid}/comments`, { body: `Respuesta ${i + 1}` }).expect(201);
    if (options.resolve) await post(ana, `/api/tickets/${created.uuid}/transitions`, { to: 'resolved', resolution: 'Listo.' }).expect(200);
    if (options.close) await post(victor, `/api/tickets/${created.uuid}/transitions`, { to: 'closed' }).expect(200);
    if (options.score) await post(victor, `/api/tickets/${created.uuid}/survey`, { score: options.score, ...(options.comment ? { comment: options.comment } : {}) }).expect(200);
    return { victor, ana, uuid: created.uuid as string };
  }

  describe('acceso', () => {
    it('el cliente no ve métricas (403); el agente solo las suyas; supervisor y administrador, las del equipo', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      for (const url of ['summary', 'agents', 'problems', 'me']) {
        expect((await victor.agent.get(`/api/metrics/${url}`).expect(403)).body.code).toBe('SAUT-E001');
      }
      for (const url of ['summary', 'agents', 'problems', 'agents/luis@ticketit.dev']) {
        expect((await ana.agent.get(`/api/metrics/${url}`).expect(403)).body.code).toBe('SAUT-E001');
      }
      await ana.agent.get('/api/metrics/me').expect(200);
      for (const email of ['sergio@ticketit.dev', 'marta@ticketit.dev']) {
        const s = await login(email);
        for (const url of ['summary', 'agents', 'problems', 'agents/ana@ticketit.dev', 'me']) await s.agent.get(`/api/metrics/${url}`).expect(200);
      }
    });

    it('son de solo lectura: no hay forma de modificar nada por aquí', async () => {
      const sergio = await login('sergio@ticketit.dev');
      for (const method of ['post', 'patch', 'delete'] as const) {
        const res = await sergio.agent[method]('/api/metrics/summary').set('X-XSRF-TOKEN', sergio.csrf).send({});
        expect([404, 405]).toContain(res.status);
      }
    });
  });

  describe('período', () => {
    it('por omisión, los últimos 30 días; devuelve el período y las metas', async () => {
      const sergio = await login('sergio@ticketit.dev');
      const res = (await sergio.agent.get('/api/metrics/summary').expect(200)).body;
      const days = (new Date(res.period.to).getTime() - new Date(res.period.from).getTime()) / 86_400_000;
      expect(Math.round(days)).toBe(30);
      expect(res.targets).toMatchObject({ firstContactPct: 75, responseCompliancePct: 95, resolutionCompliancePct: 95, csat: 4.5 });
    });

    it('rechaza fechas inválidas, invertidas o de más de 366 días (400)', async () => {
      const sergio = await login('sergio@ticketit.dev');
      for (const q of ['from=ayer', 'from=2026-10-05&to=2026-10-01', 'from=2024-01-01&to=2026-10-01']) {
        expect((await sergio.agent.get(`/api/metrics/summary?${q}`).expect(400)).body.code).toBe('CVAL-E001');
      }
    });

    it('una fecha sin hora cubre el día completo', async () => {
      const sergio = await login('sergio@ticketit.dev');
      const day = new Date().toISOString().slice(0, 10);
      const res = (await sergio.agent.get(`/api/metrics/summary?from=${day}&to=${day}`).expect(200)).body;
      expect(new Date(res.period.to).getTime() - new Date(res.period.from).getTime()).toBe(86_400_000 - 1);
    });
  });

  describe('fórmulas sobre datos reales', () => {
    it('sin tickets en el período no se inventa nada: valores null y «no-data», ceros en los conteos', async () => {
      const sergio = await login('sergio@ticketit.dev');
      const res = (await sergio.agent.get('/api/metrics/summary?from=2020-01-01&to=2020-01-31').expect(200)).body.summary;
      expect(res.tickets).toMatchObject({ created: 0, resolved: 0, closed: 0 });
      expect(res.firstContact).toEqual({ value: null, sample: 0, status: 'no-data' });
      expect(res.firstResponse.value).toBeNull();
      expect(res.csat.status).toBe('no-data');
    });

    it('FCR, primera respuesta, resolución, reapertura y conteos del período', async () => {
      await scenario(1, { resolve: true, close: true }); // primer contacto
      await scenario(2, { resolve: true }); // dos respuestas: no es primer contacto
      await scenario(0); // sin respuesta todavía: en plazo, pendiente
      const sergio = await login('sergio@ticketit.dev');
      const { summary } = (await sergio.agent.get(`/api/metrics/summary?${since()}`).expect(200)).body;

      expect(summary.tickets).toMatchObject({ created: 3, attended: 2, resolved: 2, closed: 1, autoClosed: 0, escalated: 0 });
      // Abiertos hoy: los 2 sembrados (TCK-001 en atención, TCK-002 nuevo) + el sin resolver + el resuelto sin cerrar.
      expect(summary.tickets.pending).toBe(3);
      expect(summary.firstContact).toMatchObject({ value: 50, sample: 2, status: 'critical' });
      expect(summary.firstResponse).toMatchObject({ value: 100, sample: 2, status: 'ok' });
      expect(summary.resolution).toMatchObject({ value: 100, sample: 2, status: 'ok' });
      expect(summary.reopenRate).toMatchObject({ value: 0, sample: 2, status: 'ok' });
    });

    it('reabrir un resuelto corrige hacia atrás el FCR y cuenta en la tasa de reapertura', async () => {
      const { victor, uuid } = await scenario(1, { resolve: true });
      const sergio = await login('sergio@ticketit.dev');
      const before = (await sergio.agent.get(`/api/metrics/summary?${since()}`).expect(200)).body.summary;
      expect(before.firstContact.value).toBe(100);
      await post(victor, `/api/tickets/${uuid}/transitions`, { to: 'reopened', note: 'Sigue fallando' }).expect(200);
      const after = (await sergio.agent.get(`/api/metrics/summary?${since()}`).expect(200)).body.summary;
      expect(after.firstContact.value).toBe(0);
      expect(after.reopenRate).toMatchObject({ value: 100, sample: 1, status: 'critical' });
    });

    it('CSAT: promedio de las respuestas, con «datos insuficientes» por debajo de 10; las no respondidas no cuentan', async () => {
      await scenario(1, { resolve: true, close: true, score: 5 });
      await scenario(1, { resolve: true, close: true, score: 2, comment: 'Tardaron mucho.' });
      await scenario(1, { resolve: true, close: true }); // cerrado sin responder la encuesta
      const sergio = await login('sergio@ticketit.dev');
      const { csat } = (await sergio.agent.get(`/api/metrics/summary?${since()}`).expect(200)).body.summary;
      expect(csat).toMatchObject({ value: 3.5, sample: 2, responses: 2, sent: 3, satisfiedPct: 50, status: 'no-data' });
      expect(csat.responseRate).toBeCloseTo(66.7, 1);

      const problems = (await sergio.agent.get(`/api/metrics/problems?${since()}`).expect(200)).body;
      expect(problems.lowScores).toEqual([expect.objectContaining({ score: 2, comment: 'Tardaron mucho.', assignee: 'ana@ticketit.dev' })]);
    });

    it('el cierre automático de 48 h se cuenta aparte', async () => {
      await scenario(1, { resolve: true });
      const { TicketLifecycleService } = await import('./../src/modules/tickets/ticket-lifecycle.service.js');
      app.get(TicketLifecycleService, { strict: false }).closeStaleResolved(new Date(Date.now() + 49 * 3_600_000));
      const sergio = await login('sergio@ticketit.dev');
      // El cierre ocurre «dentro de 49 h» (reloj simulado): el período debe llegar hasta ahí.
      const until = encodeURIComponent(new Date(Date.now() + 3 * 86_400_000).toISOString());
      const { summary } = (await sergio.agent.get(`/api/metrics/summary?${since()}&to=${until}`).expect(200)).body;
      expect(summary.tickets).toMatchObject({ closed: 1, autoClosed: 1 });
    });
  });

  describe('por colaborador y problemas frecuentes', () => {
    it('separa a cada agente; uno sin tickets muestra ceros (A3), no un error', async () => {
      await scenario(1, { resolve: true, close: true });
      const sergio = await login('sergio@ticketit.dev');
      const { data } = (await sergio.agent.get(`/api/metrics/agents?${since()}`).expect(200)).body;
      const row = (email: string) => data.find((r: { email: string }) => r.email === email).summary;
      expect(row('ana@ticketit.dev').tickets).toMatchObject({ created: 1, resolved: 1 });
      expect(row('luis@ticketit.dev').tickets).toMatchObject({ created: 0, resolved: 0, pending: 0 });
      expect(row('luis@ticketit.dev').firstContact.status).toBe('no-data');
    });

    it('el detalle de una persona lista sus tickets con su cumplimiento; /me es lo mismo para quien consulta', async () => {
      const { uuid } = await scenario(1, { resolve: true, close: true, score: 4 });
      const sergio = await login('sergio@ticketit.dev');
      const detail = (await sergio.agent.get(`/api/metrics/agents/ana@ticketit.dev?${since()}`).expect(200)).body;
      expect(detail).toMatchObject({ email: 'ana@ticketit.dev', name: 'Ana Agente' });
      expect(detail.tickets.find((t: { uuid: string }) => t.uuid === uuid)).toMatchObject({
        status: 'closed',
        responseStatus: 'met',
        resolutionStatus: 'met',
        firstContact: true,
        csat: 4,
      });
      const ana = await login('ana@ticketit.dev');
      const mine = (await ana.agent.get(`/api/metrics/me?${since()}`).expect(200)).body;
      expect(mine.summary.tickets).toEqual(detail.summary.tickets);
      // Una persona sin tickets ni cuenta tampoco es un error.
      const nobody = (await sergio.agent.get('/api/metrics/agents/nadie@ticketit.dev').expect(200)).body;
      expect(nobody.summary.tickets.created).toBe(0);
      expect((await sergio.agent.get('/api/metrics/agents/no-es-correo').expect(400)).body.code).toBe('CVAL-E001');
    });

    it('problemas: por categoría ordenadas por volumen, recurrencia del mismo solicitante y horas de creación', async () => {
      await scenario(1, { resolve: true, close: true, category: 'network' });
      await scenario(1, { resolve: true, close: true, category: 'network' });
      await scenario(0, { category: 'access' });
      const sergio = await login('sergio@ticketit.dev');
      const res = (await sergio.agent.get(`/api/metrics/problems?${since()}`).expect(200)).body;
      expect(res.byCategory.map((c: { category: string; count: number }) => [c.category, c.count])).toEqual([['network', 2], ['access', 1]]);
      expect(res.recurring).toEqual([expect.objectContaining({ requester: 'Víctor Lector', category: 'network', count: 2 })]);
      expect(res.byHour).toHaveLength(24);
      expect(res.byHour.reduce((a: number, b: number) => a + b, 0)).toBe(3);
    });
  });
});
