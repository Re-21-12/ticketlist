import { expect, test } from '@playwright/test';
import { capture } from './helpers';

/**
 * D-04 · RNF-10 · Los mensajes de error NO revelan el funcionamiento interno (clases del framework, rutas, trazas): hablan
 * en lenguaje de negocio con un código del catálogo. Se prueba contra el BACKEND real (`bun run start:dev`, puerto 3000).
 */
const API = process.env['E2E_API_URL'] ?? 'http://localhost:3000';
const LEAKS = /Exception|Cannot (GET|POST|PUT|PATCH|DELETE)|Unexpected|\bat [\w.<>]+ \(|node_modules|\.(ts|js):\d+|stack|ECONN|SQL|postgres/i;

const CASES = [
  { name: 'ruta-inexistente', method: 'GET', path: '/api/no-existe', status: 404, code: 'NEST-E404', title: 'No encontramos lo que buscas' },
  { name: 'metodo-no-permitido', method: 'DELETE', path: '/api/auth/sign-in', status: 405, code: 'NEST-E405', title: 'Esa acción no está disponible' },
  { name: 'sin-sesion', method: 'GET', path: '/api/tickets', status: 401, code: 'SAUT-E002', title: undefined },
] as const;

for (const item of CASES) {
  test(`D-04 · ${item.status} ${item.name}: mensaje de negocio, sin detalles internos`, async ({ page, request }, testInfo) => {
    const response = await request.fetch(`${API}${item.path}`, { method: item.method });
    const body = await response.json();
    expect(response.status()).toBe(item.status);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    expect(body.code).toBe(item.code);
    if (item.title) expect(body.title).toBe(item.title);
    expect(body).not.toHaveProperty('detail');
    expect(body).not.toHaveProperty('stack');
    expect(JSON.stringify(body)).not.toMatch(LEAKS);

    // Captura: la respuesta tal como la recibe el cliente.
    await page.setContent(`<body style="margin:0;font:14px ui-monospace,monospace;background:#101014;color:#e8e8ee;padding:24px;width:820px">
      <p style="margin:0 0 8px;color:#9aa0b4">${item.method} ${item.path} → HTTP ${response.status()}</p>
      <pre style="margin:0;white-space:pre-wrap">${JSON.stringify(body, null, 2).replace(/</g, '&lt;')}</pre></body>`);
    await capture(page, testInfo, `D-04-${item.status}-${item.name}`);
  });
}

test('D-04 · una validación (400) dice qué campo está mal, sin nombres de validadores ni de clases', async ({ page, request }, testInfo) => {
  const response = await request.post(`${API}/api/auth/sign-in`, { data: { email: 'no-es-un-correo', password: '' } });
  const body = await response.json();
  expect(response.status()).toBe(400);
  expect(body.code).toBe('CVAL-E001');
  expect(body.errors.length).toBeGreaterThan(0);
  expect(JSON.stringify(body)).not.toMatch(LEAKS);
  await page.setContent(`<body style="margin:0;font:14px ui-monospace,monospace;background:#101014;color:#e8e8ee;padding:24px;width:820px">
    <p style="margin:0 0 8px;color:#9aa0b4">POST /api/auth/sign-in → HTTP 400</p>
    <pre style="margin:0;white-space:pre-wrap">${JSON.stringify(body, null, 2).replace(/</g, '&lt;')}</pre></body>`);
  await capture(page, testInfo, 'D-04-400-validacion');
});

test('D-04 · RF-07: credenciales incorrectas dicen lo mismo exista o no la cuenta, sin revelar nada interno', async ({ page, request }, testInfo) => {
  const wrongPassword = await (await request.post(`${API}/api/auth/sign-in`, { data: { email: 'ana@ticketit.dev', password: 'Mala-Clave-1!' } })).json();
  const unknown = await (await request.post(`${API}/api/auth/sign-in`, { data: { email: 'nadie@ticketit.dev', password: 'Mala-Clave-1!' } })).json();
  expect(wrongPassword.code).toBe('SAUT-E004');
  expect(wrongPassword.title).toBe('Correo electrónico o contraseña incorrectos');
  expect(unknown.title).toBe(wrongPassword.title);
  expect(JSON.stringify(wrongPassword)).not.toMatch(LEAKS);
  await page.setContent(`<body style="margin:0;font:14px ui-monospace,monospace;background:#101014;color:#e8e8ee;padding:24px;width:820px">
    <p style="margin:0 0 8px;color:#9aa0b4">POST /api/auth/sign-in (contraseña incorrecta) → HTTP 401</p>
    <pre style="margin:0;white-space:pre-wrap">${JSON.stringify(wrongPassword, null, 2).replace(/</g, '&lt;')}</pre></body>`);
  await capture(page, testInfo, 'D-04-401-credenciales-incorrectas');
});
