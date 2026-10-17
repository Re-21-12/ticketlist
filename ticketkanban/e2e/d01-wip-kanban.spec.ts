import { expect, test } from '@playwright/test';
import { capture, inApp, signInAs } from './helpers';

const NEW_TICKET = (title: string): string => `{
  title: ${JSON.stringify(title)}, description: '', department: 'it', type: 'incident', category: 'software', priority: 'medium',
  assigneeEmail: 'ana@ticketit.dev', estimateHours: null, dueDate: null, notifyReporter: true
}`;

/**
 * D-01 · RF-01 · Kanban con límite de trabajo en progreso (WIP): el tablero no deja que haya más tickets «En progreso»
 * que agentes activos (Ana y Luis → 2), lo muestra en la columna y no ofrece iniciar otro cuando se alcanza el tope.
 */
test('D-01 · el tablero respeta el límite WIP: «En progreso» no pasa del número de agentes', async ({ page }, testInfo) => {
  await signInAs(page, 'Administrador');
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();

  // Estado de partida: 1 de 2 (TCK-001 ya está en progreso).
  await expect(page.getByText('En progreso: 1 de 2')).toBeVisible();
  await capture(page.locator('.board-columns'), testInfo, 'D-01-1-tablero-con-cupo-1-de-2');

  // Se llena el cupo: un segundo ticket pasa a «En progreso» y queda otro asignado esperando.
  const waitingUuid = await inApp<string>(
    page,
    'app-tickets',
    '_ticketsStore._ticketsService._http',
    `const first = await call(http.post('/api/tickets', ${NEW_TICKET('Ticket que llena el cupo')}));
     await call(http.post('/api/tickets/' + first.uuid + '/transitions', { to: 'in_progress' }));
     const waiting = await call(http.post('/api/tickets', ${NEW_TICKET('Ticket que espera cupo')}));
     return waiting.uuid;`,
  );
  await inApp(page, 'app-tickets', '_ticketsStore', 'http.reload();');

  await expect(page.getByText('En progreso: 2 de 2')).toBeVisible();
  await expect(page.getByText('Límite alcanzado: resuelve un ticket antes de iniciar otro.')).toBeVisible();
  const waiting = page.locator('.board-card', { hasText: 'Ticket que espera cupo' });
  await expect(waiting).toBeVisible();
  // Con el cupo lleno ya no se ofrece «Iniciar atención» en el ticket que espera.
  await expect(waiting.getByRole('button', { name: /Iniciar atención/ })).toHaveCount(0);
  await capture(page.locator('.board-columns'), testInfo, 'D-01-2-limite-alcanzado-sin-iniciar-atencion');

  // «Mover a…» tampoco lista «En progreso» para ese ticket.
  await waiting.scrollIntoViewIfNeeded();
  await waiting.getByRole('combobox').click();
  const options = await page.getByRole('option').allTextContents();
  expect(options.map((text) => text.trim())).not.toContain('En progreso');
  await capture(page, testInfo, 'D-01-3-mover-a-sin-en-progreso');
  await page.keyboard.press('Escape');

  // El servidor también lo rechaza (409 STCK-E008): no depende de que la interfaz oculte el botón.
  const code = await inApp<string>(
    page,
    'app-tickets',
    '_ticketsStore._ticketsService._http',
    `try { await call(http.post('/api/tickets/${waitingUuid}/transitions', { to: 'in_progress' })); return 'ok'; }
     catch (error) { return error.error?.code ?? 'sin-codigo'; }`,
  );
  expect(code).toBe('STCK-E008');
});
