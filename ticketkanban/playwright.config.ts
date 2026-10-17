import { defineConfig } from '@playwright/test';

/**
 * Pruebas de aceptación (Playwright) de los hallazgos D-01…D-05 de la revisión. Cada prueba deja su CAPTURA en
 * `docs/evidencias/` (raíz del repositorio) con el nombre del hallazgo: es la «Evidencia n» del informe.
 *
 *  - Pantallas (D-01, D-02, D-03, D-05): contra el front con el BFF simulado (`npm start -- --port 4310`).
 *  - Mensajes de error (D-04): contra el backend real (`bun run start:dev` en ticketlistbe, puerto 3000).
 *
 *   npm run e2e            # arranca el front si no está corriendo
 *   E2E_BASE_URL=… E2E_API_URL=… npm run e2e
 */
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4310';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.resultados',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: './e2e/.informe', open: 'never' }]],
  use: {
    baseURL,
    locale: 'es',
    trace: 'retain-on-failure',
    // El mock simula 500 ms de latencia por petición; con animaciones apagadas las capturas no salen a medias.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } }],
  webServer: process.env['E2E_NO_SERVER']
    ? undefined
    : { command: 'npm start -- --port 4310', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
