import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { TicketsRepository } from './../src/modules/tickets/tickets.repository.js';
import { TicketLifecycleService } from './../src/modules/tickets/ticket-lifecycle.service.js';
import { LogMailService } from './../src/core/mail/log-mail.service.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

/** Seguimiento del ticket: historial, comentarios inmutables, transiciones por rol, adjuntos, encuesta y cierre automático. */
describe('Ciclo de vida del ticket (e2e)', () => {
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

  const base = { title: 'No abre el portal de RR. HH.', description: '', type: 'service_request', category: 'access', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };
  /**
   * Registra un ticket. El CLIENTE no asigna (lo hace el supervisor): si se pide un responsable, se asigna
   * después como lo haría el equipo.
   */
  const create = async (s: TSession, over: { assigneeEmail?: string } & object = {}): Promise<{ uuid: string; code: string; status: string }> => {
    const { assigneeEmail, ...rest } = over;
    const created = (await post(s, '/api/tickets', { ...base, ...rest }).expect(201)).body as { uuid: string; code: string; status: string };
    if (!assigneeEmail) return created;
    const sergio = await login('sergio@ticketit.dev');
    await post(sergio, `/api/tickets/${created.uuid}/assign`, { assigneeEmail }).expect(200);
    return { ...created, status: 'assigned' };
  };
  const events = async (s: TSession, uuid: string) => (await s.agent.get(`/api/tickets/${uuid}/events`).expect(200)).body.data as { type: string; to: string | null; body: string | null; visibility: string; actorName: string }[];
  const move = (s: TSession, uuid: string, to: string, extra: object = {}) => post(s, `/api/tickets/${uuid}/transitions`, { to, ...extra });
  const statusOf = async (s: TSession, uuid: string) => (await s.agent.get(`/api/tickets/${uuid}`).expect(200)).body.status as string;
  const notificationsOf = async (s: TSession) => (await s.agent.get('/api/notifications').expect(200)).body.data as { type: string; message: string }[];

  describe('registro y asignación', () => {
    it('nace «Nuevo» con su historial, sus plazos de SLA y quién lo solicitó', async () => {
      const victor = await login('victor@ticketit.dev');
      const res = await post(victor, '/api/tickets', { ...base, priority: 'critical' }).expect(201);
      expect(res.body).toMatchObject({
        status: 'new',
        requesterName: 'Víctor Lector',
        assigneeName: null,
        sla: { responseMinutes: 120, resolutionMinutes: 120, responseStatus: 'pending', resolutionStatus: 'running' },
        nextStatuses: [],
      });
      expect((await events(victor, res.body.uuid)).map((e) => e.type)).toEqual(['CREATED']);
    });

    it('con responsable al crear nace «Asignado»; cada prioridad trae su plazo', async () => {
      const ana = await login('ana@ticketit.dev');
      const created = await post(ana, '/api/tickets', { ...base, priority: 'low', type: 'improvement', assigneeEmail: 'ana@ticketit.dev' }).expect(201);
      expect(created.body.status).toBe('assigned');
      expect(created.body.sla.resolutionMinutes).toBe(2880);
      expect(created.body.assigneeName).toBe('Ana Agente');
    });

    it('un agente NO atiende lo que no tiene asignado; el supervisor asigna y avisa al agente y al solicitante', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const sergio = await login('sergio@ticketit.dev');
      const { uuid } = await create(victor);

      expect((await move(ana, uuid, 'in_progress').expect(403)).body.code).toBe('SAUT-E001');
      const assigned = await post(sergio, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(200);
      expect(assigned.body).toMatchObject({ status: 'assigned', assigneeName: 'Ana Agente' });
      // Además queda constancia del aviso al solicitante (CU01): evento NOTIFIED.
      expect((await events(sergio, uuid)).map((e) => e.type)).toEqual(['CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTIFIED']);
      expect((await notificationsOf(ana)).some((n) => n.type === 'TICKET_ASSIGNED')).toBe(true);
      expect((await notificationsOf(victor)).some((n) => n.type === 'TICKET_STATUS_CHANGED' && n.message.includes('Ana Agente'))).toBe(true);
      await move(ana, uuid, 'in_progress').expect(200);
    });

    it('un agente puede tomar un ticket SIN responsable, pero no asignárselo a otra persona ni quitárselo a otra', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor);
      expect((await post(ana, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'luis@ticketit.dev' }).expect(403)).body.code).toBe('STCK-E005');
      await post(ana, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(200);
      const luis = await login('luis@ticketit.dev');
      expect((await post(luis, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'luis@ticketit.dev' }).expect(403)).body.code).toBe('STCK-E005');
    });

    it('no se asigna a quien no puede recibir tickets (un cliente) → 422 STCK-E006', async () => {
      const victor = await login('victor@ticketit.dev');
      const sergio = await login('sergio@ticketit.dev');
      const { uuid } = await create(victor);
      expect((await post(sergio, `/api/tickets/${uuid}/assign`, { assigneeEmail: 'victor@ticketit.dev' }).expect(422)).body.code).toBe('STCK-E006');
    });
  });

  describe('comentarios (solo se agregan)', () => {
    it('el equipo responde en público y deja notas internas que el cliente NO ve', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor, { assigneeEmail: 'ana@ticketit.dev' });

      await post(ana, `/api/tickets/${uuid}/comments`, { body: 'Ya lo reviso.' }).expect(201);
      await post(ana, `/api/tickets/${uuid}/comments`, { body: 'Parece el certificado.', internal: true }).expect(201);
      await post(victor, `/api/tickets/${uuid}/comments`, { body: 'Gracias, quedo atento.' }).expect(201);

      const asCustomer = await events(victor, uuid);
      // Los avisos al solicitante (NOTIFIED) también llevan texto: aquí solo importan los comentarios.
      expect(asCustomer.filter((e) => e.type.startsWith('COMMENT')).map((e) => e.body)).toEqual(['Ya lo reviso.', 'Gracias, quedo atento.']);
      expect(asCustomer.some((e) => e.visibility === 'internal')).toBe(false);
      const asAgent = await events(ana, uuid);
      expect(asAgent.some((e) => e.body === 'Parece el certificado.')).toBe(true);
      expect((await notificationsOf(victor)).some((n) => n.type === 'TICKET_COMMENTED')).toBe(true);
      expect((await notificationsOf(ana)).some((n) => n.type === 'TICKET_COMMENTED')).toBe(true);
    });

    it('el cliente no escribe notas internas (403); un comentario vacío da 400', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = await create(victor);
      await post(victor, `/api/tickets/${uuid}/comments`, { body: 'x', internal: true }).expect(403);
      expect((await post(victor, `/api/tickets/${uuid}/comments`, { body: '   ' }).expect(400)).body.code).toBe('CVAL-E001');
    });

    it('los comentarios previos NO se modifican ni se borran (409 STCK-E002)', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = await create(victor);
      const comment = (await post(victor, `/api/tickets/${uuid}/comments`, { body: 'Original' }).expect(201)).body;
      for (const method of ['patch', 'put', 'delete'] as const) {
        const res = await victor.agent[method](`/api/tickets/${uuid}/comments/${comment.uuid}`).set('X-XSRF-TOKEN', victor.csrf).send({ body: 'Editado' });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('STCK-E002');
      }
      expect((await events(victor, uuid)).find((e) => e.body === 'Original')).toBeTruthy();
    });

    it('un cliente ajeno ni ve ni comenta el ticket (404)', async () => {
      const victor = await login('victor@ticketit.dev');
      const rosa = await login('rosa@ticketit.dev');
      const { uuid } = await create(victor);
      await rosa.agent.get(`/api/tickets/${uuid}/events`).expect(404);
      await post(rosa, `/api/tickets/${uuid}/comments`, { body: 'hola' }).expect(404);
    });

    it('el cliente que responde a «Pendiente del cliente» devuelve el ticket a «En atención»', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor, { assigneeEmail: 'ana@ticketit.dev' });
      await move(ana, uuid, 'pending_customer', { note: '¿Qué navegador usas?' }).expect(200);
      expect(await statusOf(victor, uuid)).toBe('pending_customer');
      await post(victor, `/api/tickets/${uuid}/comments`, { body: 'Edge.' }).expect(201);
      expect(await statusOf(victor, uuid)).toBe('in_progress');
      expect((await events(ana, uuid)).filter((e) => e.type === 'STATUS_CHANGED').map((e) => e.to)).toEqual(['assigned', 'pending_customer', 'in_progress']);
    });
  });

  describe('resolución, cierre y reapertura', () => {
    async function resolved() {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor, { assigneeEmail: 'ana@ticketit.dev' });
      await post(ana, `/api/tickets/${uuid}/comments`, { body: 'Revisando.' }).expect(201);
      await move(ana, uuid, 'resolved', { resolution: 'Se renovó el certificado.' }).expect(200);
      return { victor, ana, uuid };
    }

    it('resolver exige documentar la solución (400) y avisa al solicitante', async () => {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor, { assigneeEmail: 'ana@ticketit.dev' });
      const bad = await move(ana, uuid, 'resolved').expect(400);
      expect(bad.body.errors.some((e: { path: string }) => e.path === 'resolution')).toBe(true);
      const ok = await move(ana, uuid, 'resolved', { resolution: 'Listo.' }).expect(200);
      expect(ok.body).toMatchObject({ status: 'resolved', resolution: 'Listo.', nextStatuses: ['reopened'] });
      expect((await notificationsOf(victor)).some((n) => n.message.includes('fue resuelto'))).toBe(true);
    });

    it('el solicitante confirma el cierre: «Cerrado», queda el rastro y se abre la encuesta; el equipo NO cierra por él', async () => {
      const { victor, ana, uuid } = await resolved();
      expect((await move(ana, uuid, 'closed').expect(409)).body.code).toBe('STCK-E001');
      const view = await victor.agent.get(`/api/tickets/${uuid}`).expect(200);
      expect(view.body.nextStatuses.toSorted()).toEqual(['closed', 'reopened']);

      const closed = await move(victor, uuid, 'closed').expect(200);
      expect(closed.body.status).toBe('closed');
      expect(closed.body.closedAt).not.toBeNull();
      // Los avisos al solicitante (NOTIFIED, CU01) se intercalan; el resto del rastro es el de siempre.
      const trail = (await events(victor, uuid)).map((e) => e.type);
      expect(trail.filter((type) => type !== 'NOTIFIED')).toEqual(['CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'COMMENT_PUBLIC', 'STATUS_CHANGED', 'STATUS_CHANGED', 'SURVEY_SENT']);
      expect(trail).toContain('NOTIFIED');
      expect((await victor.agent.get(`/api/tickets/${uuid}/survey`).expect(200)).body.state).toBe('pending');
      // Quien cierra no se avisa a sí mismo del cierre; la encuesta SÍ queda en su buzón aunque la haya provocado él.
      expect((await notificationsOf(ana)).some((n) => n.message.includes('confirmó el cierre'))).toBe(true);
    });

    it('un ticket cerrado no admite comentarios (409 STCK-E003) hasta reabrirlo', async () => {
      const { victor, uuid } = await resolved();
      await move(victor, uuid, 'closed').expect(200);
      expect((await post(victor, `/api/tickets/${uuid}/comments`, { body: 'una cosa más' }).expect(409)).body.code).toBe('STCK-E003');
      await move(victor, uuid, 'reopened', { note: 'Volvió a fallar.' }).expect(200);
      await post(victor, `/api/tickets/${uuid}/comments`, { body: 'una cosa más' }).expect(201);
    });

    it('rechazar la solución reabre el ticket y avisa al agente asignado (A3)', async () => {
      const { victor, ana, uuid } = await resolved();
      const reopened = await move(victor, uuid, 'reopened', { note: 'Sigue sin abrir.' }).expect(200);
      expect(reopened.body).toMatchObject({ status: 'reopened', reopenCount: 1, resolvedAt: null });
      expect((await notificationsOf(ana)).some((n) => n.type === 'TICKET_REOPENED')).toBe(true);
      await move(ana, uuid, 'in_progress').expect(200);
    });

    it('un cerrado se reabre por reincidencia solo dentro de 7 días (STCK-E004)', async () => {
      const { victor, uuid } = await resolved();
      await move(victor, uuid, 'closed').expect(200);
      const repository = app.get(TicketsRepository, { strict: false });
      const ticket = (await repository.findByUuid(uuid))!;
      await repository.update(Object.assign(Object.create(Object.getPrototypeOf(ticket) as object) as typeof ticket, ticket, { closedAt: new Date(Date.now() - 8 * 86_400_000) }));
      expect((await move(victor, uuid, 'reopened').expect(409)).body.code).toBe('STCK-E004');
    });

    it('sin respuesta tras 48 h de «Resuelto» se cierra solo, deja el evento, avisa y abre la encuesta', async () => {
      const { victor, ana, uuid } = await resolved();
      const lifecycle = app.get(TicketLifecycleService, { strict: false });
      expect(lifecycle.closeStaleResolved(new Date(Date.now() + 47 * 3_600_000))).toBe(0);
      expect(lifecycle.closeStaleResolved(new Date(Date.now() + 49 * 3_600_000))).toBe(1);

      expect(await statusOf(victor, uuid)).toBe('closed');
      const history = await events(victor, uuid);
      expect(history.find((e) => e.to === 'closed')).toMatchObject({ actorName: 'Sistema', body: expect.stringContaining('48 h') });
      expect(history.some((e) => e.type === 'SURVEY_SENT')).toBe(true);
      expect((await notificationsOf(victor)).some((n) => n.message.includes('cerró automáticamente'))).toBe(true);
      expect((await notificationsOf(victor)).some((n) => n.type === 'TICKET_SURVEY')).toBe(true);
      expect((await notificationsOf(ana)).some((n) => n.message.includes('cerró automáticamente'))).toBe(true);
      // Idempotente: ya cerrado, no se vuelve a cerrar.
      expect(lifecycle.closeStaleResolved(new Date(Date.now() + 72 * 3_600_000))).toBe(0);
    });

    it('no hay saltos imposibles ni estados inventados', async () => {
      const victor = await login('victor@ticketit.dev');
      const sergio = await login('sergio@ticketit.dev');
      const { uuid } = await create(victor);
      expect((await move(sergio, uuid, 'closed').expect(409)).body.code).toBe('STCK-E001');
      expect((await move(sergio, uuid, 'new').expect(409)).body.code).toBe('STCK-E001');
      await move(sergio, uuid, 'volando').expect(400);
    });
  });

  describe('evidencia adjunta', () => {
    const upload = (s: TSession, uuid: string, content: Buffer, filename = 'captura.png') =>
      s.agent.post(`/api/tickets/${uuid}/attachments`).set('X-XSRF-TOKEN', s.csrf).attach('file', content, filename);

    it('se sube, se adjunta a un comentario y se descarga como adjunto, con el tipo detectado', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = await create(victor);
      const file = (await upload(victor, uuid, PNG).expect(201)).body;
      expect(file).toMatchObject({ name: 'captura.png', mimeType: 'image/png', size: PNG.length });

      const comment = await post(victor, `/api/tickets/${uuid}/comments`, { body: 'Mira el error', attachmentIds: [file.id] }).expect(201);
      expect(comment.body.attachments).toEqual([file]);
      // Un adjunto se usa en UN comentario.
      expect((await post(victor, `/api/tickets/${uuid}/comments`, { body: 'otra vez', attachmentIds: [file.id] }).expect(404)).body.code).toBe('RATT-E001');

      const download = await victor.agent.get(`/api/tickets/${uuid}/attachments/${file.id}`).expect(200);
      expect(download.headers['content-type']).toContain('image/png');
      expect(download.headers['content-disposition']).toContain('attachment');
      expect(download.headers['x-content-type-options']).toBe('nosniff');
    });

    it('una imagen de más de 10 MB → 413 SATT-E001; un tipo no permitido → 415 SATT-E002; sin archivo → 400', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = await create(victor);
      const big = Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]);
      expect((await upload(victor, uuid, big).expect(413)).body.code).toBe('SATT-E001');
      expect((await upload(victor, uuid, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3]), 'virus.png').expect(415)).body.code).toBe('SATT-E002');
      expect((await post(victor, `/api/tickets/${uuid}/attachments`).expect(400)).body.code).toBe('SATT-E003');
    });

    it('otra persona no descarga ni usa el adjunto de un ticket que no ve', async () => {
      const victor = await login('victor@ticketit.dev');
      const rosa = await login('rosa@ticketit.dev');
      const { uuid } = await create(victor);
      const file = (await upload(victor, uuid, PNG).expect(201)).body;
      await rosa.agent.get(`/api/tickets/${uuid}/attachments/${file.id}`).expect(404);
      await upload(rosa, uuid, PNG).expect(404);
    });
  });

  describe('encuesta de satisfacción', () => {
    async function closedTicket() {
      const victor = await login('victor@ticketit.dev');
      const ana = await login('ana@ticketit.dev');
      const { uuid } = await create(victor, { assigneeEmail: 'ana@ticketit.dev' });
      await move(ana, uuid, 'resolved', { resolution: 'Hecho.' }).expect(200);
      await move(victor, uuid, 'closed').expect(200);
      return { victor, ana, uuid };
    }

    it('se deja en el buzón al cerrar (sin correo) y el solicitante responde si se resolvió, 1–5 y comentario opcional', async () => {
      const { victor, uuid } = await closedTicket();
      // No hay SMTP: la encuesta llega SOLO al buzón de notificaciones y no sale ningún correo.
      const inbox = (await victor.agent.get('/api/notifications').expect(200)).body.data as { type: string; message: string }[];
      expect(inbox.some((n) => n.type === 'TICKET_SURVEY' && n.message.includes('¿Se resolvió tu problema'))).toBe(true);
      expect(app.get(LogMailService, { strict: false }).outbox).toHaveLength(0);

      const answered = await post(victor, `/api/tickets/${uuid}/survey`, { resolved: true, score: 5, comment: 'Muy amable.' }).expect(200);
      expect(answered.body).toMatchObject({ state: 'answered', score: 5, comment: 'Muy amable.', resolved: true });
      expect((await post(victor, `/api/tickets/${uuid}/survey`, { resolved: true, score: 1 }).expect(409)).body.code).toBe('SSRV-E002');
      expect((await events(victor, uuid)).map((e) => e.type)).toContain('SURVEY_ANSWERED');
    });

    it('indicar si se resolvió es obligatorio; el comentario es opcional; la calificación debe ser entera de 1 a 5', async () => {
      const { victor, uuid } = await closedTicket();
      // Sin «resolved» no se acepta (CU02): hay que decir si se resolvió el problema.
      expect((await post(victor, `/api/tickets/${uuid}/survey`, { score: 4 }).expect(400)).body.code).toBe('CVAL-E001');
      for (const score of [0, 6, 3.5, 'cinco']) await post(victor, `/api/tickets/${uuid}/survey`, { resolved: true, score }).expect(400);
      expect((await post(victor, `/api/tickets/${uuid}/survey`, { resolved: true, score: 4 }).expect(200)).body).toMatchObject({ score: 4, comment: null });
    });

    it('solo la responde quien registró el ticket; para los demás «no hay encuesta» (404)', async () => {
      const { ana, uuid } = await closedTicket();
      const sergio = await login('sergio@ticketit.dev');
      for (const other of [ana, sergio]) {
        expect((await other.agent.get(`/api/tickets/${uuid}/survey`).expect(404)).body.code).toBe('SSRV-E001');
        await post(other, `/api/tickets/${uuid}/survey`, { resolved: true, score: 5 }).expect(404);
      }
    });

    it('no existe antes de cerrar y vence a los 7 días (410 SSRV-E003)', async () => {
      const victor = await login('victor@ticketit.dev');
      const { uuid } = await create(victor);
      await victor.agent.get(`/api/tickets/${uuid}/survey`).expect(404);

      const closed = await closedTicket();
      const surveys = app.get(TicketsRepository, { strict: false });
      void surveys;
      const lifecycle = app.get(TicketLifecycleService, { strict: false });
      void lifecycle;
      // Vencida: se adelanta el reloj del PROCESO simulando que la encuesta ya expiró.
      const repository = (await import('./../src/modules/tickets/surveys/ticket-surveys.repository.js')).TicketSurveysRepository;
      const store = app.get(repository, { strict: false });
      const survey = store.find(closed.uuid)!;
      store.save({ ...survey, expiresAt: new Date(Date.now() - 1000) });
      expect((await post(closed.victor, `/api/tickets/${closed.uuid}/survey`, { resolved: true, score: 5 }).expect(410)).body.code).toBe('SSRV-E003');
      expect((await closed.victor.agent.get(`/api/tickets/${closed.uuid}/survey`).expect(200)).body.state).toBe('expired');
    });

    it('una calificación baja (1–2) avisa a los supervisores', async () => {
      const { victor, uuid } = await closedTicket();
      const sergio = await login('sergio@ticketit.dev');
      await post(victor, `/api/tickets/${uuid}/survey`, { resolved: true, score: 2, comment: 'Tardaron.' }).expect(200);
      expect((await notificationsOf(sergio)).some((n) => n.type === 'TICKET_SURVEY_ALERT' && n.message.includes('2/5'))).toBe(true);
    });
  });
});
