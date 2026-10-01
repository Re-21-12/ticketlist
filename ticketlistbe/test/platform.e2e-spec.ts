import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/config/app.setup.js';
import { loadEnv } from './../src/config/env.schema.js';

/**
 * Plataforma (docs/standard/observability.md, docs/design/auth-flows.md §7): X-Request-Id, 405 con
 * `Allow`, health checks y rate limiting por IP. Si `REDIS_URL` está definido corre contra Redis
 * real (`bun run test:e2e:redis`); si no, contra el almacén en memoria.
 */
describe('Plataforma (e2e)', () => {
  let app: INestApplication<App>;
  const saved = { ...process.env };

  async function boot(env: Record<string, string> = {}): Promise<void> {
    Object.assign(process.env, { NODE_ENV: 'test', ...env });
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app, loadEnv());
    await app.init();
  }

  afterEach(async () => {
    await app.close();
    process.env = { ...saved };
  });

  describe('X-Request-Id', () => {
    it('genera uno si no viene, y respeta el entrante si es válido', async () => {
      await boot();
      const generated = await request(app.getHttpServer()).get('/api/health').expect(200);
      expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

      const respected = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'proxy-req-12345')
        .expect(200);
      expect(respected.headers['x-request-id']).toBe('proxy-req-12345');
    });

    it('descarta un id con formato inválido (no se refleja texto arbitrario)', async () => {
      await boot();
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .set('X-Request-Id', 'x"; <script>')
        .expect(200);
      expect(res.headers['x-request-id']).not.toContain('<');
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('también viaja en los errores de guards (401)', async () => {
      await boot();
      const res = await request(app.getHttpServer()).get('/api/tickets').expect(401);
      expect(res.headers['x-request-id']).toBeDefined();
    });
  });

  describe('Health', () => {
    it('liveness y readiness son públicos y no se cachean mal', async () => {
      await boot();
      await request(app.getHttpServer()).get('/api/health').expect(200, { status: 'ok' });
      const ready = await request(app.getHttpServer()).get('/api/health/ready').expect(200);
      expect(ready.body.status).toBe('ok');
      expect(Object.keys(ready.body.checks)[0]).toMatch(/^kv:(memory|redis)$/);
    });

    it('no cuentan para el rate limit por IP', async () => {
      await boot({ RATE_LIMIT_GLOBAL_PER_MIN: '2' });
      for (let i = 0; i < 6; i++) await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });

  describe('405 Method Not Allowed (RFC 9110 §15.5.6)', () => {
    it('ruta existente con otro método → 405 + Allow + problem+json', async () => {
      await boot();
      const res = await request(app.getHttpServer()).delete('/api/auth/sign-in').expect(405);
      expect(res.headers['allow']).toContain('POST');
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 405, code: 'NEST-E405' });
    });

    it('ruta inexistente sigue siendo 404', async () => {
      await boot();
      await request(app.getHttpServer()).get('/api/no-existe').expect(404);
    });

    it('el método correcto no se ve afectado', async () => {
      await boot();
      await request(app.getHttpServer()).get('/api/problems').expect(200);
    });
  });

  describe('Rate limiting por IP', () => {
    /** IP única por test (vía X-Forwarded-For + TRUST_PROXY): con Redis real los contadores persisten. */
    const uniqueIp = () => `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250) + 1).join('.')}`;

    it('el excedente → 429 SRTL-E001 con Retry-After y RateLimit-*', async () => {
      await boot({ RATE_LIMIT_GLOBAL_PER_MIN: '3', TRUST_PROXY: 'true' });
      const ip = uniqueIp();
      const get = () => request(app.getHttpServer()).get('/api/problems').set('X-Forwarded-For', ip);

      const first = await get().expect(200);
      expect(first.headers['ratelimit-limit']).toBe('3');
      expect(first.headers['ratelimit-remaining']).toBe('2');

      await get().expect(200);
      await get().expect(200);
      const blocked = await get().expect(429);

      expect(blocked.headers['content-type']).toContain('application/problem+json');
      expect(blocked.body).toMatchObject({ status: 429, code: 'SRTL-E001' });
      expect(blocked.body.context.retryAfterSeconds).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBe(blocked.body.context.retryAfterSeconds);
      expect(blocked.headers['ratelimit-remaining']).toBe('0');
    });

    it('cada IP tiene su propio contador', async () => {
      await boot({ RATE_LIMIT_GLOBAL_PER_MIN: '1', TRUST_PROXY: 'true' });
      const [a, b] = [uniqueIp(), uniqueIp()];
      const get = (ip: string) => request(app.getHttpServer()).get('/api/problems').set('X-Forwarded-For', ip);
      await get(a).expect(200);
      await get(a).expect(429);
      await get(b).expect(200);
    });

    it('corre ANTES que la sesión: una ráfaga sin sesión también se frena', async () => {
      await boot({ RATE_LIMIT_GLOBAL_PER_MIN: '2', TRUST_PROXY: 'true' });
      const ip = uniqueIp();
      const get = () => request(app.getHttpServer()).get('/api/tickets').set('X-Forwarded-For', ip);
      await get().expect(401);
      await get().expect(401);
      await get().expect(429);
    });
  });
});
