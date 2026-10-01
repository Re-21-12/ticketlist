import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Prefijo de claves de Redis distinto por prueba (aislamiento contra Redis real).
    setupFiles: ['./test/setup-e2e.ts'],
  },
});
