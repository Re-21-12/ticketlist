import { expect, test } from '@playwright/test';
import { capture, goTo, signInAs } from './helpers';

/**
 * D-05 · RF-03 · El «Alta rápida» permite adjuntar el documento (evidencia) al registrar el ticket: se valida al elegirlo,
 * se sube al crear y queda en el historial del ticket.
 */
test('D-05 · el alta rápida adjunta evidencia y queda en el historial', async ({ page }, testInfo) => {
  await signInAs(page, 'Cliente');
  await goTo(page, '/tickets/new');
  await expect(page.getByRole('heading', { name: 'Alta rápida de ticket' })).toBeVisible();

  const picker = page.locator('app-evidence-picker');
  await expect(picker).toBeVisible();
  await expect(picker).toContainText('Evidencia');
  await expect(picker).toContainText('Imágenes, PDF, Excel, CSV');

  // Un tipo no admitido se rechaza con el motivo y NO se agrega (A2).
  await picker.locator('input[type=file]').setInputFiles({ name: 'programa.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') });
  await expect(picker.locator('.ep-errors')).toContainText('no es un tipo admitido');
  await expect(picker.locator('.ep-chip')).toHaveCount(0);

  // Un PNG y un PDF válidos se agregan a la lista.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await picker.locator('input[type=file]').setInputFiles([
    { name: 'captura-del-error.png', mimeType: 'image/png', buffer: png },
    { name: 'informe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') },
  ]);
  await expect(picker.locator('.ep-chip')).toHaveCount(2);

  // Se completa el formulario.
  await page.locator('#field-title').fill('No puedo entrar a la VPN');
  for (const field of ['type', 'priority']) {
    await page.locator('app-dynamic-field', { has: page.locator(`#field-${field}`) }).locator('.p-select').click();
    await page.getByRole('option').first().click();
  }
  for (const field of ['department', 'category']) {
    await page.locator('app-dynamic-field', { has: page.locator(`#field-${field}`) }).locator('.p-autocomplete-dropdown').click();
    await page.getByRole('option').first().click();
  }
  await picker.scrollIntoViewIfNeeded();
  await capture(page.locator('app-ticket-new'), testInfo, 'D-05-1-alta-rapida-con-evidencia');

  await page.getByRole('button', { name: 'Crear ticket' }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  // El ticket nace con su evidencia: aparece en el historial de «Mis tickets».
  await goTo(page, '/my-tickets');
  await page.locator('.mt-item', { hasText: 'No puedo entrar a la VPN' }).click();
  const timeline = page.locator('.mt-timeline');
  await expect(timeline).toContainText('Evidencia adjunta al registrar el ticket.');
  await expect(timeline).toContainText('captura-del-error.png');
  await expect(timeline).toContainText('informe.pdf');
  await capture(page.locator('app-my-tickets'), testInfo, 'D-05-2-evidencia-en-el-historial');
});
