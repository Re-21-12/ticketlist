import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';
import { DEV_PASSWORD } from './../src/modules/users/users.seed.js';

/** La descripción es texto enriquecido (HTML del editor): el backend solo guarda formato seguro. */
describe('Descripción de ticket: texto enriquecido saneado (e2e)', () => {
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

  async function create(description: string) {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/sign-in').send({ email: 'victor@ticketit.dev', password: DEV_PASSWORD }).expect(200);
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('XSRF-TOKEN=')) ?? '';
    const xsrf = decodeURIComponent(raw.split(';')[0].split('=')[1] ?? '');
    return agent
      .post('/api/tickets')
      .set('X-XSRF-TOKEN', xsrf)
      .send({ title: 'Falla de red', description, type: 'incident', category: 'network', priority: 'high' });
  }

  it('conserva el formato permitido', async () => {
    const res = await create('<p><strong>Sin red</strong> en el piso 2</p><ul><li>desde ayer</li></ul>').then((r) => {
      expect(r.status).toBe(201);
      return r.body;
    });
    expect(res.description).toBe('<p><strong>Sin red</strong> en el piso 2</p><ul><li>desde ayer</li></ul>');
  });

  it('descarta scripts, eventos y enlaces javascript: antes de guardar', async () => {
    const res = await create('<p onclick="x()">Hola</p><script>alert(1)</script><a href="javascript:alert(1)">clic</a><img src=x onerror=alert(1)>');
    expect(res.status).toBe(201);
    expect(res.body.description).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(res.body.description).toContain('Hola');
  });

  it('un editor vacío se guarda como cadena vacía', async () => {
    const res = await create('<p><br></p>');
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('');
  });
});
