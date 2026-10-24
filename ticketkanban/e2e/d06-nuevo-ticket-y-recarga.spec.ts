import { expect, test, type Page } from '@playwright/test';
import { capture, goTo, inApp, signInAs } from './helpers';

/** Elige la primera opción de un campo del diálogo: un `p-select` (pocas opciones) o un autocompletar con flecha (más de 5). */
async function pickFirst(page: Page, field: string, kind: 'select' | 'autocomplete'): Promise<void> {
  const host = page.locator('app-dynamic-field', { has: page.locator(`#field-${field}`) });
  await host.locator(kind === 'select' ? '.p-select' : '.p-autocomplete-dropdown').click();
  await page.getByRole('option').first().click();
}

/**
 * Revisión posterior a D-05 (pantalla «Nuevo ticket» del tablero): los catálogos se listan al abrirlos SIN escribir nada,
 * el diálogo también permite adjuntar evidencia y el tablero tiene su botón «Recargar».
 */
test('Nuevo ticket · los catálogos abren su lista al pulsar la flecha, sin escribir nada', async ({ page }, testInfo) => {
  await signInAs(page, 'Administrador');
  await page.getByRole('button', { name: 'Nuevo ticket' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Nuevo ticket' }).or(dialog)).toBeVisible();

  for (const field of ['department', 'category']) {
    const host = dialog.locator('app-dynamic-field', { has: page.locator(`#field-${field}`) });
    await host.locator('.p-autocomplete-dropdown').click();
    await expect(page.getByRole('option').first()).toBeVisible(); // se ve la lista, no un spinner pegado
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await expect(host.locator('.p-autocomplete-loader')).toHaveCount(0);
    if (field === 'category') await capture(page, testInfo, 'D-06-1-categoria-lista-al-abrir');
    await page.keyboard.press('Escape');
  }
});

test('Nuevo ticket · el diálogo permite adjuntar evidencia y queda en el historial', async ({ page }, testInfo) => {
  await signInAs(page, 'Cliente');
  await page.getByRole('button', { name: 'Nuevo ticket' }).click();
  const dialog = page.getByRole('dialog');

  // Paso 1 · Clasificación
  await dialog.locator('#field-title').fill('No abre el portal de nómina');
  await pickFirst(page, 'department', 'autocomplete');
  await pickFirst(page, 'type', 'select');
  await pickFirst(page, 'category', 'autocomplete');
  await expect(dialog.locator('app-evidence-picker')).toHaveCount(0); // la evidencia NO aparece en los primeros pasos
  await dialog.getByRole('button', { name: /Siguiente/ }).click();

  // Paso 2 · Urgencia y plan
  await pickFirst(page, 'priority', 'select');
  await expect(dialog.locator('app-evidence-picker')).toHaveCount(0);
  await dialog.getByRole('button', { name: /Siguiente/ }).click();

  // Paso 3 · último: aparece el selector de evidencia justo antes de «Crear ticket»
  const picker = dialog.locator('app-evidence-picker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('Evidencia');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await picker.locator('input[type=file]').setInputFiles([
    { name: 'captura-portal.png', mimeType: 'image/png', buffer: png },
    { name: 'programa.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') },
  ]);
  await expect(picker.locator('.ep-chip')).toHaveCount(1); // el .exe se rechaza con el motivo
  await expect(picker.locator('.ep-errors')).toContainText('no es un tipo admitido');
  await picker.scrollIntoViewIfNeeded();
  await capture(dialog, testInfo, 'D-06-2-nuevo-ticket-con-evidencia');

  await dialog.getByRole('button', { name: 'Crear ticket' }).click();
  await expect(dialog).toBeHidden();

  // El ticket nació con su evidencia: aparece en el historial de «Mis tickets».
  await goTo(page, '/my-tickets');
  await page.locator('.mt-item', { hasText: 'No abre el portal de nómina' }).click();
  const timeline = page.locator('.mt-timeline');
  await expect(timeline).toContainText('Evidencia adjunta al registrar el ticket.');
  await expect(timeline).toContainText('captura-portal.png');
  await capture(page.locator('app-my-tickets'), testInfo, 'D-06-3-evidencia-en-el-historial');
});

test('Tablero · el botón «Recargar» está para todos los roles y trae lo que cambió en el servidor', async ({ page }, testInfo) => {
  // Un rol de solo lectura no crea tickets, pero sí puede recargar.
  await signInAs(page, 'Auditor');
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo ticket' })).toHaveCount(0);

  // Alguien crea un ticket por otro lado (aquí, directo al servidor simulado): el tablero no se entera solo.
  await signInAs(page, 'Administrador');
  await expect(page.getByText('Cargando tablero…')).toBeHidden();
  await inApp(
    page,
    'app-tickets',
    '_ticketsStore._ticketsService._http',
    `await call(http.post('/api/tickets', { title: 'Ticket creado desde otro lado', description: '', department: 'it', type: 'incident', category: 'software', priority: 'medium', assigneeEmail: '', estimateHours: null, dueDate: null, notifyReporter: false }));`,
  );
  const card = page.locator('.board-card', { hasText: 'Ticket creado desde otro lado' });
  await expect(card).toHaveCount(0);

  await page.getByRole('button', { name: 'Recargar' }).click();
  await expect(card).toBeVisible();
  await capture(page.locator('.board-header'), testInfo, 'D-06-4-boton-recargar-en-el-tablero');
});
