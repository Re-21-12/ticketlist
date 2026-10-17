import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Carpeta de las capturas: `docs/evidencias/` en la raíz del repositorio (la «Evidencia n» de cada hallazgo). */
export const EVIDENCE_DIR = resolve(__dirname, '..', '..', 'docs', 'evidencias');

/** Guarda una captura con el nombre del hallazgo (`D-01-…png`) y la adjunta al informe HTML de Playwright. */
export async function capture(target: Page | Locator, testInfo: TestInfo, name: string): Promise<string> {
  const path = resolve(EVIDENCE_DIR, `${name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  const buffer = await target.screenshot({ path });
  await testInfo.attach(name, { body: buffer, contentType: 'image/png' });
  return path;
}

export type TRole = 'Administrador' | 'Agente' | 'Supervisor' | 'Auditor' | 'Cliente';

/**
 * Entra con el usuario de demostración de ese rol (solo desarrollo: el mismo atajo del selector de la pantalla de acceso).
 * El BFF simulado vive en memoria: NO se recarga la página después (se perdería la sesión); se navega con los enlaces.
 */
export async function signInAs(page: Page, role: TRole): Promise<void> {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: role, exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

/** Navega con el enlace del menú (sin recargar). En pantallas angostas el menú es un cajón: se usa el enlace del DOM. */
export async function goTo(page: Page, href: string): Promise<void> {
  await page.locator(`a[href="${href}"]`).first().evaluate((link: HTMLElement) => link.click());
  await page.waitForURL(new RegExp(`${href.replace(/[/?]/g, '\\$&')}`));
}

/**
 * Ejecuta `script` DENTRO de la app con su `HttpClient` (y el BFF simulado) para PREPARAR datos de una prueba; lo que se
 * comprueba se hace siempre con la interfaz. `httpPath` es la ruta desde el componente de `hostSelector` hasta un
 * `HttpClient` (p. ej. `_ticketsStore._ticketsService._http`). En el script: `http` y `call(observable)` → promesa.
 */
export async function inApp<T>(page: Page, hostSelector: string, httpPath: string, script: string): Promise<T> {
  return page.evaluate(
    ({ hostSelector, httpPath, script }) => {
      // Solo desarrollo: `ng` es la API de depuración de Angular.
      const ng = (window as unknown as { ng: { getComponent: (el: Element) => unknown } }).ng;
      const host = document.querySelector(hostSelector) as Element;
      const http = httpPath.split('.').reduce((value, key) => (value as Record<string, unknown>)[key], ng.getComponent(host));
      const call = (observable: { subscribe: (observer: { next: (v: unknown) => void; error: (e: unknown) => void }) => void }) =>
        new Promise((resolve, reject) => observable.subscribe({ next: resolve, error: reject }));
      return new Function('http', 'call', `return (async () => { ${script} })()`)(http, call);
    },
    { hostSelector, httpPath, script },
  ) as Promise<T>;
}
