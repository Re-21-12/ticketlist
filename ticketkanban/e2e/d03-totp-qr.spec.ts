import { expect, test } from '@playwright/test';
import { capture, goTo, signInAs } from './helpers';

/**
 * D-03 · RNF-09 · Al configurar el autenticador (TOTP) se muestra la imagen QR para escanearla, además de la clave y,
 * al confirmar, los códigos de recuperación de un solo uso.
 */
test('D-03 · el alta del autenticador genera el código QR y los códigos de recuperación', async ({ page }, testInfo) => {
  await signInAs(page, 'Agente');
  await goTo(page, '/profile');
  await page.getByRole('tab', { name: /Seguridad/ }).click();

  const card = page.locator('.totp-card');
  await card.getByRole('button', { name: 'Configurar autenticador' }).click();

  // La imagen QR se dibuja de verdad (tiene contenido), no solo existe la etiqueta.
  const qr = card.getByRole('img', { name: /Código QR/ });
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 100)).toBe(true);
  expect(await qr.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  // Junto al QR: la clave en bloques y para copiarla.
  await expect(card.locator('.totp-secret code')).toHaveText(/^(\w{4} )+\w{4}$/);
  await expect(card.getByRole('button', { name: 'Copiar clave' })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await capture(card, testInfo, 'D-03-1-codigo-qr-y-clave');

  // Confirmar con el código de la app (en el mock es 123456) entrega los 10 códigos de recuperación.
  await card.locator('#field-code').fill('123456');
  await card.getByRole('button', { name: 'Activar autenticador' }).click();
  await expect(card.locator('.totp-code')).toHaveCount(10);
  await expect(card.getByRole('button', { name: 'Listo' })).toBeDisabled(); // hasta confirmar que se guardaron
  await capture(card, testInfo, 'D-03-2-codigos-de-recuperacion');

  await card.getByLabel('Ya guardé mis códigos en un lugar seguro').check();
  await card.getByRole('button', { name: 'Listo' }).click();
  await expect(card.getByText('Te quedan')).toBeVisible();
  await capture(card, testInfo, 'D-03-3-autenticador-activo');
});
