---
description: Lint + build + tests del front con errores frescos (sin caché) y resumen de lo que falló
---

# Check completo de ticketkanban

Corre, en este orden y SIN detenerte al primer fallo, y reporta un resumen al final:

1. `npm run lint` — nomenclatura (`$`, `$_`, `_`, prefijos `I`/`T`/`E`) y reglas TS. Cualquier `error` es un fallo real.
2. `npx ng build` — errores de ngtsc/plantillas (`NG*`, `TS*`). El warning de presupuesto del bundle inicial se reporta con el tamaño, no se trata como fallo.
3. `npx ng test --watch=false` — vitest.

Si algo falla, muestra el archivo:línea y el mensaje exacto; no lo arregles salvo que te lo pida. Si todo pasa, dilo en una línea con el tamaño del bundle inicial.
