import { expect, test } from '@playwright/test';
import { capture, signInAs } from './helpers';

/**
 * D-02 · RNF-08 · El topbar no se desborda en dispositivos móviles: ningún control se sale de la pantalla, no hay scroll
 * horizontal y los botones del topbar quedan como íconos (con su nombre accesible).
 */
for (const device of [
  { name: 'telefono-360', width: 360, height: 740 },
  { name: 'telefono-390', width: 390, height: 844 },
  { name: 'tableta-640', width: 640, height: 900 },
]) {
  test(`D-02 · el topbar cabe en ${device.width} px sin desbordarse`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: device.width, height: device.height });
    await signInAs(page, 'Agente');
    const topbar = page.locator('.app-topbar');
    await expect(topbar).toBeVisible();

    // La página no se desplaza a los lados y el topbar no es más ancho que la pantalla.
    const metrics = await page.evaluate(() => {
      const bar = document.querySelector('.app-topbar') as HTMLElement;
      const viewport = document.documentElement.clientWidth;
      const overflowing = [...bar.querySelectorAll<HTMLElement>('button, a, .app-role-switch, app-notification-panel')]
        .map((el) => ({ el: el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? el.tagName, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.right > viewport + 0.5 || box.left < -0.5))
        .map(({ el, box }) => `${el}: ${Math.round(box.left)}→${Math.round(box.right)}`);
      return { pageScroll: document.documentElement.scrollWidth - viewport, barScroll: bar.scrollWidth - bar.clientWidth, overflowing };
    });
    expect(metrics.pageScroll).toBeLessThanOrEqual(0);
    expect(metrics.barScroll).toBeLessThanOrEqual(0);
    expect(metrics.overflowing).toEqual([]);

    // Los botones del topbar son íconos (sin texto visible) pero conservan nombre accesible.
    for (const name of ['Modo oscuro', 'Cerrar sesión']) {
      const button = topbar.getByRole('button', { name });
      await expect(button).toBeVisible();
      expect((await button.boundingBox())!.width).toBeLessThanOrEqual(64);
    }
    await expect(topbar.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
    await capture(topbar, testInfo, `D-02-topbar-${device.name}`);
    await capture(page, testInfo, `D-02-pantalla-${device.name}`);
  });
}
