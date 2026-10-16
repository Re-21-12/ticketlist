import { defineConfig } from 'vitest/config';

/**
 * Ajustes del runner de pruebas.
 *
 * `testTimeout`: los specs de pantalla renderizan la app entera contra el mock del BFF (tabla
 * dinámica, formulario, overlays de optimus-ui). Con el valor por defecto de Vitest (5 s) el primer
 * `await` del render se pasa de tiempo cuando el equipo tiene varios workers corriendo a la vez y
 * el fallo es un timeout sin relación con lo que el spec comprueba. 20 s deja margen sin alargar la
 * espera real de un spec que sí está colgado: los `vi.waitFor` de cada prueba acotan su propia espera.
 */
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
