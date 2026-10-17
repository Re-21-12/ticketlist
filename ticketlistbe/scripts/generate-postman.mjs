#!/usr/bin/env node
/**
 * Genera la colección de Postman y los entornos (local / producción / tailnet) a partir del OpenAPI de la API.
 *
 *   node scripts/generate-postman.mjs                      # lee http://localhost:3000/api/openapi.json
 *   node scripts/generate-postman.mjs --url https://tickets.glumi.lat/api/openapi.json
 *   node scripts/generate-postman.mjs --file ./openapi.json
 *
 * Sin dependencias. Salida en `docs/postman/` (la raíz del repo). El OpenAPI sale de los schemas Zod, así que
 * regenerar tras cambiar un endpoint mantiene la colección al día. La carpeta «00 · Prueba de humo» es a mano
 * (flujo con aserciones) y se puede correr en consola con `newman` (ver docs/postman/README.md).
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, '../../docs/postman');
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const source = arg('file')
  ? JSON.parse(readFileSync(resolve(arg('file')), 'utf8'))
  : await fetch(arg('url') ?? 'http://localhost:3000/api/openapi.json').then((r) => {
      if (!r.ok) throw new Error(`No pude leer el OpenAPI (${r.status}). ¿La API corre con API_DOCS_ENABLED=true?`);
      return r.json();
    });

const uid = (text) => {
  const h = createHash('sha1').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

// ── Muestras de cuerpo a partir del JSON Schema ─────────────────────────────────────────────────
const resolveRef = (schema) => {
  if (!schema?.$ref) return schema;
  return schema.$ref
    .replace(/^#\//, '')
    .split('/')
    .reduce((node, key) => node?.[key], source);
};

function sample(schema, depth = 0) {
  schema = resolveRef(schema) ?? {};
  if (depth > 6) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined && schema.default !== null) return schema.default;
  if (schema.enum) return schema.enum.find((v) => v !== '') ?? schema.enum[0];
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants) {
    const pick = variants.find((v) => Object.keys(resolveRef(v) ?? {}).length > 0 && !(resolveRef(v).enum?.length === 1 && resolveRef(v).enum[0] === ''));
    return sample(pick ?? variants[0], depth + 1);
  }
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map((s) => sample(s, depth + 1)));
  switch (schema.type) {
    case 'object': {
      const out = {};
      const required = new Set(schema.required ?? []);
      for (const [key, value] of Object.entries(schema.properties ?? {})) {
        if (required.has(key)) out[key] = sample(value, depth + 1);
      }
      return out;
    }
    case 'array':
      return schema.minItems ? [sample(schema.items, depth + 1)] : [];
    case 'integer':
    case 'number':
      return schema.minimum ?? 1;
    case 'boolean':
      return false;
    case 'string': {
      if (schema.format === 'email') return 'qa@ticketit.dev';
      if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
      if (schema.format === 'date') return '2026-12-31';
      if (schema.format === 'date-time') return '2026-12-31T12:00:00.000Z';
      const min = schema.minLength ?? 1;
      return 'texto de prueba'.padEnd(min, 'x').slice(0, Math.max(min, Math.min(schema.maxLength ?? 15, 15)));
    }
    default:
      return null;
  }
}

// ── Variables de ruta: ids que la prueba de humo (o tú) van guardando ───────────────────────────
const PATH_VARIABLES = [
  [/^\/api\/tickets\/\{uuid\}\/comments\/\{commentUuid\}/, { uuid: 'ticketUuid', commentUuid: 'commentUuid' }],
  [/^\/api\/tickets\/\{uuid\}\/attachments\/\{attachmentId\}/, { uuid: 'ticketUuid', attachmentId: 'attachmentId' }],
  [/^\/api\/tickets\/\{uuid\}/, { uuid: 'ticketUuid' }],
  [/^\/api\/users\/\{uuid\}/, { uuid: 'userUuid' }],
  [/^\/api\/catalogs\/\{key\}\/items\/\{uuid\}/, { key: 'catalogKey', uuid: 'catalogItemUuid' }],
  [/^\/api\/catalogs\/\{key\}/, { key: 'catalogKey' }],
  [/^\/api\/jobs\/\{key\}/, { key: 'jobKey' }],
  [/^\/api\/menu-items\/\{uuid\}/, { uuid: 'menuItemUuid' }],
  [/^\/api\/role-permissions\/\{uuid\}/, { uuid: 'rolePermissionUuid' }],
  [/^\/api\/relationships\/admin\/\{uuid\}/, { uuid: 'relationshipUuid' }],
  [/^\/api\/relationships\/\{uuid\}/, { uuid: 'relationshipUuid' }],
  [/^\/api\/notifications\/\{uuid\}/, { uuid: 'notificationUuid' }],
  [/^\/api\/audit-logs\/\{uuid\}/, { uuid: 'auditLogUuid' }],
  [/^\/api\/auth\/sessions\/\{id\}/, { id: 'sessionId' }],
  [/^\/api\/problems\/\{code\}/, { code: 'problemCode' }],
  [/^\/api\/metrics\/agents\/\{email\}/, { email: 'agentEmail' }],
];
const DEFAULT_VARIABLES = {
  catalogKey: 'ticket-status',
  jobKey: 'auto-close',
  problemCode: 'SAUT-E004',
  agentEmail: 'ana@ticketit.dev',
};
const usedVariables = new Set();

const variableFor = (path, param) => {
  for (const [pattern, map] of PATH_VARIABLES) if (pattern.test(path) && map[param]) return map[param];
  return param;
};

// ── Guiones (scripts) ───────────────────────────────────────────────────────────────────────────
const lines = (text) => text.trim().split('\n').map((l) => l.replace(/^ {6}/, ''));

/**
 * Antes de CADA petición: las que modifican llevan `X-XSRF-TOKEN` = cookie `XSRF-TOKEN` (la API responde 403 SAUT-E003 si no).
 * Se lee de la cookie y, si el entorno no la expone en este guion (newman), de la variable `xsrfToken` que guarda el guion posterior.
 */
const PRE_REQUEST = lines(`
      const method = pm.request.method.toUpperCase();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        const token = pm.cookies.get('XSRF-TOKEN') || pm.collectionVariables.get('xsrfToken');
        if (token) pm.request.headers.upsert({ key: 'X-XSRF-TOKEN', value: token });
      }
`);

/** Después de CADA petición: guarda el token CSRF vigente y, si la API contestó con un error (RFC 9457), deja el código en la consola. */
const TEST_ALL = lines(`
      const xsrf = pm.cookies.get('XSRF-TOKEN');
      if (xsrf) pm.collectionVariables.set('xsrfToken', xsrf);
      if (pm.response.code >= 400) {
        let body = {};
        try { body = pm.response.json(); } catch (e) { /* no era JSON */ }
        console.warn('HTTP ' + pm.response.code + ' ' + (body.code || '') + ' ' + (body.title || ''));
      }
`);

const event = (listen, exec) => ({ listen, script: { type: 'text/javascript', exec } });

// ── Peticiones ──────────────────────────────────────────────────────────────────────────────────
function toRequest(method, path, operation) {
  const variables = [];
  const pathSegments = path
    .replace(/^\//, '')
    .split('/')
    .map((segment) => {
      const match = /^\{(.+)\}$/.exec(segment);
      if (!match) return segment;
      const name = variableFor(path, match[1]);
      usedVariables.add(name);
      variables.push({ key: match[1], value: `{{${name}}}` });
      return `:${match[1]}`;
    });

  const query = (operation.parameters ?? [])
    .filter((p) => p.in === 'query')
    .map((p) => ({ key: p.name, value: String(p.example ?? sample(p.schema) ?? ''), disabled: true, description: p.description }));

  const header = [];
  let body;
  const content = operation.requestBody?.content ?? {};
  if (content['application/json']) {
    header.push({ key: 'Content-Type', value: 'application/json' });
    body = { mode: 'raw', raw: JSON.stringify(sample(content['application/json'].schema), null, 2), options: { raw: { language: 'json' } } };
  } else if (content['multipart/form-data']) {
    const props = resolveRef(content['multipart/form-data'].schema)?.properties ?? {};
    body = {
      mode: 'formdata',
      formdata: Object.entries(props).map(([key, value]) => (value.format === 'binary' ? { key, type: 'file', src: [] } : { key, type: 'text', value: '' })),
    };
  }

  return {
    method: method.toUpperCase(),
    header,
    body,
    description: [operation.summary, operation.description].filter(Boolean).join('\n\n') || undefined,
    url: {
      raw: `{{baseUrl}}/${pathSegments.join('/')}`,
      host: ['{{baseUrl}}'],
      path: pathSegments,
      query: query.length ? query : undefined,
      variable: variables.length ? variables : undefined,
    },
  };
}

const SKIP = (method, path) => method === 'head' || path === '/api/notifications/stream'; // SSE: Postman no lo pinta bien

const folders = new Map();
for (const [path, item] of Object.entries(source.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (SKIP(method, path)) continue;
    const tag = operation.tags?.[0] ?? 'Otros';
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push({
      name: `${method.toUpperCase()} ${path.replace(/^\/api/, '')}`,
      request: toRequest(method, path, operation),
    });
  }
}

const tagOrder = ['Health', 'Auth', 'BFF', 'Tickets', 'Tickets · Seguimiento'];
const rest = [...folders.keys()].filter((t) => !tagOrder.includes(t)).sort((a, b) => a.localeCompare(b, 'es'));
const apiFolders = [...tagOrder, ...rest].filter((t) => folders.has(t)).map((tag) => ({ name: tag, item: folders.get(tag) }));

// ── Carpeta a mano: prueba de humo con aserciones ───────────────────────────────────────────────
const req = (name, method, path, { body, tests = [], pre = [], noAuth } = {}) => ({
  name,
  event: [...(pre.length ? [event('prerequest', pre)] : []), ...(tests.length ? [event('test', tests)] : [])],
  request: {
    method,
    header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    body: body ? { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } : undefined,
    url: { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.replace(/^\//, '').split('/') },
    auth: noAuth ? { type: 'noauth' } : undefined,
  },
});

const smoke = {
  name: '00 · Prueba de humo',
  description:
    'Flujo completo con aserciones: salud → iniciar sesión → shell → crear ticket → leerlo → comentar → historial → error 404 sin detalles internos → cerrar sesión. ' +
    'Úsalo con el entorno elegido (credenciales de un CLIENTE/solicitante: crea y comenta sus tickets). Se corre entero con «Run folder» o con newman.',
  item: [
    req('1 · Salud de la API', 'GET', '/api/health', {
      tests: lines(`
      pm.test('200', () => pm.response.to.have.status(200));
      `),
    }),
    req('2 · Iniciar sesión', 'POST', '/api/auth/sign-in', {
      body: { email: '{{email}}', password: '{{password}}' },
      tests: lines(`
      pm.test('200 y rol del shell', () => {
        pm.response.to.have.status(200);
        const body = pm.response.json();
        pm.expect(body.user.email).to.eql(pm.environment.get('email'));
        pm.collectionVariables.set('sessionRole', body.user.role);
      });
      pm.test('cookies de sesión y CSRF', () => {
        pm.expect(pm.cookies.has('sid'), 'cookie sid').to.be.true;
        pm.expect(pm.cookies.has('XSRF-TOKEN'), 'cookie XSRF-TOKEN').to.be.true;
      });
      `),
    }),
    req('3 · Shell (menú y permisos)', 'GET', '/api/bff/shell', {
      tests: lines(`
      pm.test('200 con usuario y menú', () => {
        pm.response.to.have.status(200);
        const body = pm.response.json();
        pm.expect(body).to.have.property('user');
        pm.expect(body).to.have.property('menu');
      });
      `),
    }),
    req('4 · Crear ticket', 'POST', '/api/tickets', {
      body: {
        title: 'Prueba de humo Postman {{$timestamp}}',
        description: 'Ticket creado por la colección de Postman.',
        type: 'incident',
        category: 'software',
        priority: 'medium',
        department: 'it',
        notifyReporter: true,
      },
      tests: lines(`
      pm.test('creado', () => {
        pm.expect([200, 201]).to.include(pm.response.code);
        const body = pm.response.json();
        pm.expect(body.uuid).to.be.a('string');
        pm.collectionVariables.set('ticketUuid', body.uuid);
      });
      `),
    }),
    req('5 · Leer el ticket', 'GET', '/api/tickets/{{ticketUuid}}', {
      tests: lines(`
      pm.test('200, estado inicial y siguientes pasos', () => {
        pm.response.to.have.status(200);
        const body = pm.response.json();
        pm.expect(body.uuid).to.eql(pm.collectionVariables.get('ticketUuid'));
        pm.expect(body.status).to.be.oneOf(['new', 'assigned']);
        pm.expect(body.nextStatuses).to.be.an('array');
      });
      `),
    }),
    req('6 · Comentar', 'POST', '/api/tickets/{{ticketUuid}}/comments', {
      body: { body: 'Comentario de prueba desde Postman.', internal: false },
      tests: lines(`
      pm.test('comentario creado', () => pm.expect([200, 201]).to.include(pm.response.code));
      `),
    }),
    req('7 · Historial del ticket', 'GET', '/api/tickets/{{ticketUuid}}/events', {
      tests: lines(`
      pm.test('200 y el comentario está en el historial', () => {
        pm.response.to.have.status(200);
        const events = pm.response.json().data;
        pm.expect(events.map((e) => e.type)).to.include('COMMENT_PUBLIC');
      });
      `),
    }),
    req('8 · Ruta inexistente: error sin detalles internos', 'GET', '/api/no-existe', {
      tests: lines(`
      pm.test('404 con código del catálogo y sin detalles internos', () => {
        pm.response.to.have.status(404);
        pm.expect(pm.response.headers.get('Content-Type')).to.include('application/problem+json');
        const body = pm.response.json();
        pm.expect(body.code).to.eql('NEST-E404');
        pm.expect(body).to.not.have.property('detail');
        pm.expect(body).to.not.have.property('stack');
        pm.expect(JSON.stringify(body)).to.not.match(/Exception|node_modules|\\.ts:\\d+/);
      });
      `),
    }),
    req('9 · Sin el token CSRF la API rechaza la escritura', 'POST', '/api/tickets/{{ticketUuid}}/comments', {
      body: { body: 'Sin token CSRF' },
      // Pisa el guion de la colección: quita el encabezado que agregaría.
      pre: lines(`
      pm.request.headers.remove('X-XSRF-TOKEN');
      pm.request.headers.add({ key: 'X-XSRF-TOKEN', value: 'token-falso' });
      `),
      tests: lines(`
      pm.test('403 SAUT-E003', () => {
        pm.response.to.have.status(403);
        pm.expect(pm.response.json().code).to.eql('SAUT-E003');
      });
      `),
    }),
    req('10 · Cerrar sesión', 'POST', '/api/auth/sign-out', {
      tests: lines(`
      pm.test('204', () => pm.response.to.have.status(204));
      `),
    }),
    req('11 · Ya sin sesión: 401', 'GET', '/api/tickets', {
      tests: lines(`
      pm.test('401', () => pm.response.to.have.status(401));
      `),
    }),
  ],
};
// El pre-request de la colección pisa el header del paso 9; para que valga el token falso se vuelve a poner DESPUÉS.
smoke.item[8].event = [event('prerequest', lines(`
      pm.request.headers.upsert({ key: 'X-XSRF-TOKEN', value: 'token-falso' });
      `)), ...smoke.item[8].event.filter((e) => e.listen === 'test')];

// ── Colección ───────────────────────────────────────────────────────────────────────────────────
const collectionVariables = [
  ...[...usedVariables].sort().map((key) => ({ key, value: DEFAULT_VARIABLES[key] ?? '' })),
  { key: 'sessionRole', value: '' },
  { key: 'xsrfToken', value: '' },
].filter((v, i, all) => all.findIndex((o) => o.key === v.key) === i);

const collection = {
  info: {
    _postman_id: uid('ticketit-collection'),
    name: 'Ticketit API',
    description:
      'Generada desde el OpenAPI de la API (`ticketlistbe/scripts/generate-postman.mjs`). Elige un entorno (local, producción o tailnet), ' +
      'rellena `email` y `password` y corre «00 · Prueba de humo». La sesión es por cookie `sid` y las escrituras llevan `X-XSRF-TOKEN` (lo pone el guion de la colección).',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [event('prerequest', PRE_REQUEST), event('test', TEST_ALL)],
  variable: collectionVariables,
  item: [smoke, ...apiFolders],
};

// ── Entornos ────────────────────────────────────────────────────────────────────────────────────
const environment = (name, baseUrl, extra = {}) => ({
  id: uid(`env-${name}`),
  name: `Ticketit · ${name}`,
  values: [
    { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
    { key: 'email', value: extra.email ?? '', type: 'default', enabled: true },
    { key: 'password', value: extra.password ?? '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
});

const ENVIRONMENTS = {
  local: environment('local', 'http://localhost:3000', { email: 'victor@ticketit.dev', password: 'ticketit-dev' }), // cuentas de DEMOSTRACIÓN (SEED_DEMO_DATA)
  produccion: environment('producción (pruebas)', 'https://tickets.glumi.lat'),
  tailnet: environment('tailnet (Tailscale)', 'https://ticketit-db.tail2a34b8.ts.net'),
};

mkdirSync(resolve(OUT_DIR, 'environments'), { recursive: true });
const write = (file, data) => writeFileSync(resolve(OUT_DIR, file), `${JSON.stringify(data, null, 2)}\n`);
write('ticketit.postman_collection.json', collection);
for (const [key, env] of Object.entries(ENVIRONMENTS)) write(`environments/${key}.postman_environment.json`, env);

const total = apiFolders.reduce((n, f) => n + f.item.length, 0);
console.log(`Colección: ${smoke.item.length} pasos de humo + ${total} endpoints en ${apiFolders.length} carpetas → ${OUT_DIR}`);
