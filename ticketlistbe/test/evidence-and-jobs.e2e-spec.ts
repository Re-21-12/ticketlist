import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { OBJECT_STORAGE, type IObjectStorage } from './../src/core/storage/object-storage.js';
import { JobsService } from './../src/modules/jobs/jobs.service.js';
import { TicketLifecycleService } from './../src/modules/tickets/ticket-lifecycle.service.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** Caja ISO BMFF mínima (tamaño + tipo + contenido) para fabricar videos con una duración conocida. */
const box = (type: string, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, body]);
};
const u32 = (n: number): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
};
/** MP4 con el moov al final y `seconds` de duración (escala 1000). */
const mp4 = (seconds: number): Buffer =>
  Buffer.concat([box('ftyp', Buffer.from('isom'), u32(0), Buffer.from('isom')), box('mdat', Buffer.alloc(32)), box('moov', box('mvhd', u32(0), u32(0), u32(0), u32(1000), u32(seconds * 1000), Buffer.alloc(80)))]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.7 evidencia');
const XLSX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml xl/workbook.xml')]);
const XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
const CSV = Buffer.from('id,estado,1,abierto,2,cerrado');

/**
 * CU02 · evidencia en el bucket (imágenes, PDF, Excel, CSV y videos cortos) y tareas programadas configurables
 * (cierre automático de tickets resueltos).
 */
describe('Evidencia en el bucket y tareas programadas (e2e)', () => {
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
    const csrf = (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('XSRF-TOKEN='))?.split(';')[0]?.split('=')[1];
    return { agent, csrf: csrf ?? '' };
  };
  type TSession = Awaited<ReturnType<typeof login>>;
  const post = (s: TSession, url: string, body: object = {}) => s.agent.post(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const patch = (s: TSession, url: string, body: object = {}) => s.agent.patch(url).set('X-XSRF-TOKEN', s.csrf).send(body);
  const upload = (s: TSession, uuid: string, content: Buffer, filename: string) => s.agent.post(`/api/tickets/${uuid}/attachments`).set('X-XSRF-TOKEN', s.csrf).attach('file', content, filename);

  const draft = { title: 'Pantalla en blanco', description: '', type: 'incident', category: 'software', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: true };
  const createAssigned = async (customer: TSession) => {
    const created = (await post(customer, '/api/tickets', draft).expect(201)).body as { uuid: string };
    const sergio = await login('sergio@ticketit.dev');
    await post(sergio, `/api/tickets/${created.uuid}/assign`, { assigneeEmail: 'ana@ticketit.dev' }).expect(200);
    return created.uuid;
  };

  describe('subida de evidencia', () => {
    it('acepta imágenes, PDF, Excel, CSV, texto y videos cortos, y los clasifica', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      const cases: [Buffer, string, string, string][] = [
        [PNG, 'foto.png', 'image/png', 'image'],
        [PDF, 'informe.pdf', 'application/pdf', 'document'],
        [XLSX, 'ventas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'document'],
        [XLS, 'viejo.xls', 'application/vnd.ms-excel', 'document'],
        [CSV, 'datos.csv', 'text/csv', 'document'],
        [mp4(90), 'falla.mp4', 'video/mp4', 'video'],
      ];
      for (const [content, name, mimeType, kind] of cases) {
        const body = (await upload(victor, uuid, content, name).expect(201)).body;
        expect(body, name).toMatchObject({ name, mimeType, kind });
      }
    });

    it('un video guarda su duración y no puede pasar de 5 minutos (422 SATT-E004); sin duración verificable también se rechaza (SATT-E005)', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      const ok = (await upload(victor, uuid, mp4(300), 'justo.mp4').expect(201)).body;
      expect(ok).toMatchObject({ kind: 'video', durationSeconds: 300 });
      expect((await upload(victor, uuid, mp4(301), 'largo.mp4').expect(422)).body.code).toBe('SATT-E004');
      const sinMoov = Buffer.concat([box('ftyp', Buffer.from('isom'), u32(0), Buffer.from('isom')), box('mdat', Buffer.alloc(16))]);
      expect((await upload(victor, uuid, sinMoov, 'raro.mp4').expect(422)).body.code).toBe('SATT-E005');
    });

    it('el tope de tamaño depende del tipo: un documento de más de 25 MB → 413 SATT-E001; una imagen, a partir de 10 MB', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      expect((await upload(victor, uuid, Buffer.concat([PDF, Buffer.alloc(25 * 1024 * 1024)]), 'enorme.pdf').expect(413)).body.code).toBe('SATT-E001');
      expect((await upload(victor, uuid, Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]), 'grande.png').expect(413)).body.code).toBe('SATT-E001');
      // Un PDF de 6 MB sí pasa (antes el tope único era 5 MB).
      await upload(victor, uuid, Buffer.concat([PDF, Buffer.alloc(6 * 1024 * 1024)]), 'medio.pdf').expect(201);
    });

    it('rechaza lo que no es evidencia aunque lleve extensión válida (ejecutable, zip cualquiera, foto HEIC)', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      for (const [content, name] of [
        [Buffer.from([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3]), 'virus.pdf'],
        [Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'datos.xlsx'],
        [Buffer.concat([u32(0x18), Buffer.from('ftypheic'), u32(0), Buffer.from('mif1')]), 'foto.mp4'],
      ] as [Buffer, string][]) {
        expect((await upload(victor, uuid, content, name).expect(415)).body.code, name).toBe('SATT-E002');
      }
    });

    it('el CONTENIDO vive en el bucket (la metadata no lo trae) y se descarga igual que se subió', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      const file = (await upload(victor, uuid, PDF, 'informe.pdf').expect(201)).body;
      const storage = app.get<IObjectStorage>(OBJECT_STORAGE);
      expect((await storage.get(`tickets/${uuid}/${file.id}`))?.equals(PDF)).toBe(true);
      const download = await victor.agent.get(`/api/tickets/${uuid}/attachments/${file.id}`).expect(200);
      expect(Buffer.from(download.body as Buffer).equals(PDF)).toBe(true);
      expect(download.headers['content-disposition']).toContain('attachment');
    });

    it('evidencia de la SOLUCIÓN: quien resuelve adjunta fotos al cambio de estado y el solicitante las ve y las descarga', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = await createAssigned(victor);
      const ana = await login('ana@ticketit.dev');
      const photo = (await upload(ana, uuid, PNG, 'despues.png').expect(201)).body;
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Se reemplazó el cable.', attachmentIds: [photo.id] }).expect(200);

      const history = (await victor.agent.get(`/api/tickets/${uuid}/events`).expect(200)).body.data as { to: string | null; attachments: { id: string; kind: string }[] }[];
      const resolvedEvent = history.find((e) => e.to === 'resolved');
      expect(resolvedEvent?.attachments).toEqual([expect.objectContaining({ id: photo.id, kind: 'image' })]);
      await victor.agent.get(`/api/tickets/${uuid}/attachments/${photo.id}`).expect(200);
      // Un adjunto ya amarrado a un renglón del historial no se puede reutilizar.
      expect((await post(ana, `/api/tickets/${uuid}/comments`, { body: 'otra vez', attachmentIds: [photo.id] }).expect(404)).body.code).toBe('RATT-E001');
    });

    it('CU02 A1: un comentario previo no se puede editar (409 STCK-E002)', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = (await post(victor, '/api/tickets', draft).expect(201)).body.uuid as string;
      const comment = (await post(victor, `/api/tickets/${uuid}/comments`, { body: 'Primero' }).expect(201)).body;
      const edited = await patch(victor, `/api/tickets/${uuid}/comments/${comment.uuid}`, { body: 'Cambiado' }).expect(409);
      expect(edited.body.code).toBe('STCK-E002');
      expect(edited.body.title).toContain('comentarios previos no pueden modificarse');
    });
  });

  describe('tareas programadas', () => {
    it('el administrador las lista con su próxima corrida; el resto no tiene acceso', async () => {
      const marta = await login('marta@ticketit.dev');
      const list = (await marta.agent.get('/api/jobs').expect(200)).body.data as { key: string; enabled: boolean; cron: string; params: { afterHours?: number }; nextRunAt: string | null }[];
      const job = list.find((j) => j.key === 'ticket-auto-close');
      expect(job).toMatchObject({ enabled: true, cron: '*/10 * * * *', params: { afterHours: 48 } });
      expect(job?.nextRunAt).not.toBeNull();
      for (const email of ['sergio@ticketit.dev', 'ana@ticketit.dev', 'victor@ticketit.dev']) {
        const other = await login(email);
        await other.agent.get('/api/jobs').expect(403);
        await patch(other, '/api/jobs/ticket-auto-close', { enabled: true, cron: '* * * * *' }).expect(403);
      }
    });

    it('cambia el cron y el plazo (validados) y desactivarla quita su próxima corrida', async () => {
      const marta = await login('marta@ticketit.dev');
      expect((await patch(marta, '/api/jobs/ticket-auto-close', { enabled: true, cron: 'cada rato' }).expect(400)).body.errors[0].message).toContain('expresión cron');
      await patch(marta, '/api/jobs/ticket-auto-close', { enabled: true, cron: '0 * * * *', params: { afterHours: 0 } }).expect(400);
      const updated = (await patch(marta, '/api/jobs/ticket-auto-close', { enabled: true, cron: '0 * * * *', params: { afterHours: 24 } }).expect(200)).body;
      expect(updated).toMatchObject({ cron: '0 * * * *', params: { afterHours: 24 }, updatedBy: 'marta@ticketit.dev' });
      const off = (await patch(marta, '/api/jobs/ticket-auto-close', { enabled: false, cron: '0 * * * *' }).expect(200)).body;
      expect(off).toMatchObject({ enabled: false, nextRunAt: null });
      await patch(marta, '/api/jobs/no-existe', { enabled: true, cron: '* * * * *' }).expect(404);
    });

    it('«Ejecutar ahora» cierra los resueltos vencidos según el PLAZO configurado y registra la corrida', async () => {
      const victor = await login('victor@ticketit.dev');
      const uuid = await createAssigned(victor);
      const ana = await login('ana@ticketit.dev');
      await post(ana, `/api/tickets/${uuid}/transitions`, { to: 'resolved', resolution: 'Hecho.' }).expect(200);
      const marta = await login('marta@ticketit.dev');

      // Con 48 h todavía no vence; la corrida lo dice y no cierra nada.
      const jobs = app.get(JobsService, { strict: false });
      const early = jobs.run('ticket-auto-close', 'marta@ticketit.dev', new Date(Date.now() + 10 * 3_600_000));
      expect(early).toMatchObject({ lastRunStatus: 'ok', lastRunTrigger: 'marta@ticketit.dev' });
      expect(early.lastRunSummary).toContain('Ningún ticket');
      expect((await victor.agent.get(`/api/tickets/${uuid}`).expect(200)).body.status).toBe('resolved');

      // El administrador baja el plazo a 6 h: la misma corrida, 10 h después, ya lo cierra.
      await patch(marta, '/api/jobs/ticket-auto-close', { enabled: true, cron: '*/10 * * * *', params: { afterHours: 6 } }).expect(200);
      const later = jobs.run('ticket-auto-close', 'marta@ticketit.dev', new Date(Date.now() + 10 * 3_600_000));
      expect(later.lastRunSummary).toContain('Cerró 1 ticket');
      expect((await victor.agent.get(`/api/tickets/${uuid}`).expect(200)).body.status).toBe('closed');
      // Y la encuesta quedó en el buzón del solicitante (sin correo).
      const inbox = (await victor.agent.get('/api/notifications').expect(200)).body.data as { type: string }[];
      expect(inbox.some((n) => n.type === 'TICKET_SURVEY')).toBe(true);
      const listed = (await marta.agent.get('/api/jobs').expect(200)).body.data[0];
      expect(listed.lastRunSummary).toContain('Cerró 1 ticket');
    });

    it('el planificador corre solo las tareas ACTIVAS cuyo cron coincide con el minuto (una vez por minuto)', async () => {
      const jobs = app.get(JobsService, { strict: false });
      const marta = await login('marta@ticketit.dev');
      await patch(marta, '/api/jobs/ticket-auto-close', { enabled: true, cron: '30 14 * * *' }).expect(200);
      // 14:30 en UTC−6 = 20:30 UTC
      const hit = new Date('2026-10-05T20:30:10Z');
      expect(jobs.tick(hit)).toBe(1);
      expect(jobs.tick(new Date('2026-10-05T20:30:50Z'))).toBe(0); // el mismo minuto no se repite
      expect(jobs.tick(new Date('2026-10-05T20:31:10Z'))).toBe(0); // otro minuto: no coincide
      await patch(marta, '/api/jobs/ticket-auto-close', { enabled: false, cron: '30 14 * * *' }).expect(200);
      expect(jobs.tick(new Date('2026-10-06T20:30:10Z'))).toBe(0); // desactivada
      const lifecycle = app.get(TicketLifecycleService, { strict: false });
      expect(lifecycle.closeStaleResolved(new Date())).toBe(0);
    });
  });
});
