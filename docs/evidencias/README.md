# Evidencias de los hallazgos D-01 … D-05 (y D-06, revisión posterior)

Capturas generadas por las pruebas de **Playwright** (`ticketkanban/e2e/`). Cada archivo lleva el código del hallazgo.
Se regeneran en cada corrida (`npm run e2e` en `ticketkanban/`); el informe HTML queda en `ticketkanban/e2e/.informe/`.

| Hallazgo | Requisito | Prueba | Capturas |
|---|---|---|---|
| **D-01** Kanban sin límite WIP | RF-01 | `e2e/d01-wip-kanban.spec.ts` | `D-01-1-tablero-con-cupo-1-de-2.png` · `D-01-2-limite-alcanzado-sin-iniciar-atencion.png` · `D-01-3-mover-a-sin-en-progreso.png` |
| **D-02** Topbar se desborda en móviles | RNF-08 | `e2e/d02-topbar-movil.spec.ts` (360, 390 y 640 px) | `D-02-topbar-telefono-360.png` · `D-02-topbar-telefono-390.png` · `D-02-topbar-tableta-640.png` y la pantalla completa de cada una (`D-02-pantalla-…`) |
| **D-03** TOTP sin imagen QR | RNF-09 | `e2e/d03-totp-qr.spec.ts` | `D-03-1-codigo-qr-y-clave.png` · `D-03-2-codigos-de-recuperacion.png` · `D-03-3-autenticador-activo.png` |
| **D-04** Mensajes de error internos | RNF-10 | `e2e/d04-errores-seguros.spec.ts` (contra el backend real) | `D-04-404-ruta-inexistente.png` · `D-04-405-metodo-no-permitido.png` · `D-04-401-sin-sesion.png` · `D-04-400-validacion.png` · `D-04-401-credenciales-incorrectas.png` |
| **D-05** Alta rápida sin documento | RF-03 | `e2e/d05-alta-rapida-evidencia.spec.ts` | `D-05-1-alta-rapida-con-evidencia.png` · `D-05-2-evidencia-en-el-historial.png` |
| **D-06** Catálogos sin lista al abrir, «Nuevo ticket» sin adjuntos y sin «Recargar» (revisión posterior) | RF-03 | `e2e/d06-nuevo-ticket-y-recarga.spec.ts` | `D-06-1-categoria-lista-al-abrir.png` · `D-06-2-nuevo-ticket-con-evidencia.png` · `D-06-3-evidencia-en-el-historial.png` · `D-06-4-boton-recargar-en-el-tablero.png` |

## Cómo se corrigió cada uno
- **D-01** — Límite de trabajo en progreso (WIP): como máximo tantos tickets «En progreso» a la vez como agentes activos. El tablero muestra «En progreso: n de m»; al llegar al tope no ofrece «Iniciar atención» ni «Mover a… En progreso» y el servidor responde 409 `STCK-E008`. Los cambios del sistema (el cliente responde) no se frenan.
- **D-02** — Bajo 768 px los botones del topbar quedan como ícono (el texto sigue como nombre accesible), los elementos pueden encogerse y el selector de rol se acota: nada se sale de la pantalla ni hay scroll horizontal.
- **D-03** — El alta del autenticador muestra el QR (generado en el navegador), la clave para copiar y, al confirmar, 10 códigos de recuperación de un solo uso.
- **D-04** — Los errores del framework (`NEST-E<status>`) ya no usan el nombre de la clase (`NotFoundException`) ni el mensaje original (`Cannot GET /api/…`): hablan en lenguaje de negocio, sin `detail`. Credenciales incorrectas: «Correo electrónico o contraseña incorrectos».
- **D-05** — El alta rápida acepta evidencia (imágenes, PDF, Excel, CSV, videos cortos): se valida al elegirla, se sube al crear el ticket y queda en el historial.
- **D-06** — Las listas de catálogo (Departamento, Categoría, «Asignado a») se abren al pulsar la flecha SIN escribir (antes quedaba el spinner girando: `p-autocomplete` solo abre al CAMBIAR la referencia de `suggestions`). El diálogo «Nuevo ticket» del tablero acepta evidencia en su último paso (mismo servicio que el alta rápida) y el tablero tiene el botón «Recargar» para todos los roles.

## Cómo repetirlo
```bash
# front con el BFF simulado (puerto 4310) y backend real (puerto 3000)
cd ticketkanban && npm start -- --port 4310
cd ticketlistbe && bun run start:dev
cd ticketkanban && npm run e2e          # o: E2E_NO_SERVER=1 npx playwright test d01
```
