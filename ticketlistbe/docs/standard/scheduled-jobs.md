# Tareas programadas (cierre automático configurable)

Pantalla **«Tareas programadas»** (`/jobs`, solo administración): activar o desactivar una tarea, cambiar **cuándo** corre (cron) y sus **parámetros**, y ejecutarla a mano. Hoy hay una tarea: el **cierre automático de tickets resueltos** (CU02 A4).

Código: `src/modules/jobs/` · Pruebas: `cron-expression.spec.ts`, `test/evidence-and-jobs.e2e-spec.ts`.

## 1. La tarea `ticket-auto-close`

Cierra los tickets en **«Resuelto»** cuyo solicitante no respondió pasado el plazo (**48 h** por defecto). Cada cierre:

1. Cambia el estado a «Cerrado» y deja el **evento** en el historial (actor «Sistema», «Cierre automático: N h sin respuesta»).
2. **Avisa al solicitante en su buzón** («se cerró automáticamente por falta de respuesta») y al responsable.
3. **Deja la encuesta en el buzón del solicitante**: ¿se resolvió el problema? (sí/no), calificación 1–5 y un comentario **opcional**. Vigente 7 días, una sola vez, sin recordatorios. Un «no se resolvió» o una nota baja avisa a los supervisores.

No hay correo (no se usa SMTP): el buzón de notificaciones es el único canal.

## 2. Configuración

| Campo | Qué es | Validación |
|---|---|---|
| `enabled` | Si el planificador la ejecuta. «Ejecutar ahora» funciona aunque esté desactivada | boolean |
| `cron` | Cuándo corre. 5 campos: `minuto hora día-del-mes mes día-de-la-semana`. Por defecto `*/10 * * * *` (cada 10 minutos) | `JOB.CRON_INVALID` (400) |
| `params.afterHours` | Horas en «Resuelto» sin respuesta antes de cerrar (por defecto 48) | entero 1–720 |

- **Cron**: `*` (todos), listas `0,30`, rangos `8-17`, pasos `*/10` o `0-30/5`; día de la semana 0–6 (0 = domingo, 7 también). Si el día del mes y el de la semana están restringidos, basta uno de los dos (como cron). Ejemplos: cada hora `0 * * * *` · de lunes a viernes a las 8:00 `0 8 * * 1-5`.
- **Zona horaria**: se interpreta en la del calendario hábil del servicio (**UTC−6**, `DEFAULT_CALENDAR`).
- La pantalla muestra la **próxima corrida** y la **última** (cuándo, quién —`schedule` o el correo del administrador— y qué hizo).
- Cada cambio queda en la **auditoría** (middleware global); el cierre en sí queda en el historial de cada ticket.

## 3. Endpoints (solo `ScheduledJob`: administrador)

| Endpoint | Qué hace |
|---|---|
| `GET /api/jobs` | Lista las tareas con configuración, próxima y última corrida |
| `PATCH /api/jobs/:key` | Actualiza `enabled`, `cron` y `params` (400 si el cron o el plazo no son válidos; 404 `RJOB-E001`) |
| `POST /api/jobs/:key/run` | «Ejecutar ahora»: corre la tarea en este momento y devuelve su última corrida |

## 4. Cómo corre

El planificador es un temporizador **en el propio proceso** (cada 30 s mira las tareas activas y ejecuta las que su cron marca para ese minuto, una vez por minuto). Una tarea no corre dos veces a la vez. Persiste en `scheduled_jobs` (migración `EvidenceBucketSurveyJobs1791000000000`); al arrancar solo se **agregan** las tareas que falten, lo que un administrador cambió no se pisa.

**Límite — una sola réplica de la API**: con varias, todas ejecutarían la tarea a la vez (el cierre es idempotente, pero se duplicaría trabajo). Para escalar habría que tomar un candado en Redis o mover el planificador a un proceso aparte.

En pruebas no hay reloj: se llama a `JobsService.tick(now)` / `run(key)`.
