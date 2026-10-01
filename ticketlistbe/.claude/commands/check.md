---
description: Lint + build + unit + e2e del BFF y resumen de lo que falló
---

# Check completo de ticketlistbe

Corre, sin detenerte al primer fallo, y resume al final:

1. `bun run lint` (oxlint type-aware) — warnings incluidos en el reporte.
2. `bun run build` (nest build / tsc).
3. `bun run test` (unit, vitest) — incluye `error-catalog.docs.spec.ts`: si falla, la documentación de errores quedó desactualizada (`bun run docs:errors` + §4.2/§5).
4. `bun run test:e2e` (supertest: validación Zod → 400, permisos → 403, OpenAPI generado).

Reporta archivo:línea y mensaje exacto de cada fallo; no arregles nada salvo que te lo pida.
