# ticketlistbe — BFF de Ticketit

NestJS 12 (ESM, `nodenext`: imports relativos con extensión `.js`), Zod 4, CASL 7, bun.

```bash
bun run start:dev   # http://localhost:3000/api · Scalar UI en /api/reference · JSON en /api/openapi.json
bun run docs:errors # regenera las tablas de docs/standard/error-catalog.md desde el código
bun run lint        # oxlint
bun run test        # unit (vitest)
bun run test:e2e    # e2e (supertest)
docker compose up -d  # Postgres :5433 + Redis :6380 (puertos propios)
bun run test:redis  # unit + e2e contra Redis real (REDIS_URL=redis://localhost:6380)
bun run test:pg     # unit + e2e con Postgres real (DATABASE_URL=postgres://ticketit:ticketit-dev@localhost:5433/ticketit), incluida la persistencia
bun run migration:run | migration:show | migration:revert | migration:generate <ruta> | migration:create <ruta>   # TypeORM
```

## Arquitectura en capas (heredada de wallet-api)

```
src/
├── main.ts / app.module.ts   bootstrap: prefijo /api, pipe Zod global, filtro global, Swagger
├── config/                   env.schema.ts (Zod, falla al arrancar), app.setup.ts (compartido con e2e), session.config.ts, openapi.config.ts + scalar.config.ts
├── common/                   codes/error-codes.ts (catálogo) · filters/exception-filter.filter.ts (RFC 9457) · problems/ (`GET /api/problems/:code`)
├── core/                     bases genéricas y plomería transversal
│   ├── base.entity.ts · base.repository.ts · base.service.ts · base.controller.ts
│   ├── interfaces/           Ibase.*.ts, Ipaginated-result, Icustom-code…
│   ├── dtos/                 base-pagination, uuid-param, paginated-response, problem-details (Zod)
│   ├── interceptors/http-cache.interceptor.ts · utils/etag.util.ts   Cache-Control + ETag/304
│   ├── zod/create-zod-dto.ts · pipes/zod-validation.pipe.ts · decorators/api-zod.decorator.ts
│   ├── kv/                   IKeyValueStore: MemoryKvStore (dev/test) · RedisKvStore (prod). TODO lo efímero va por aquí
│   ├── rate-limit/           RateLimitService + @RateLimit / @SkipRateLimit + guard global por IP (el PRIMERO)
│   ├── observability/        X-Request-Id + una línea de log JSON por request · health/ (liveness, readiness, apagado)
│   ├── context/request-context.ts   (AsyncLocalStorage; en wallet-api: nestjs-cls)
│   └── exceptions/app.exception.ts  (CustomBusinessException)
├── modules/<recurso>/        DOMINIO
│   ├── schemas/<recurso>.schema.ts      contrato Zod (espejo del front)
│   ├── dtos/create-*.dto.ts · update-*.dto.ts · *-response.dto.ts · *-query.dto.ts
│   ├── <recurso>.entity.ts · <recurso>s.repository.ts · <recurso>s.service.ts · <recurso>s.controller.ts
│   ├── <recurso>s.module.ts        repositorio + servicio (lo importan otros módulos)
│   └── <recurso>s-http.module.ts   solo el controller (lo importa AppModule)
└── bff/<pantalla>/           endpoints por PANTALLA: orquestan servicios de dominio y devuelven la
                              forma exacta de la vista (shell, board). Sin reglas de negocio propias.
```

**Flujo de una request:** `X-Request-Id` + log → 405 con `Allow` → `RateLimitGuard` (por IP) → express-session (cookie `sid`, en Redis si hay `REDIS_URL`) → `SessionContextMiddleware` (`RequestContext`) → `SessionAuthGuard` (401) → `CsrfGuard` (403 en mutaciones) → `CaslGuard` (`@CheckAbility`, permiso por TIPO) → `ZodValidationPipe` (DTO) → Controller → Service (lectura por FILA, permiso por REGISTRO, `If-Match`, notificaciones) → Repository → `toResponse()` → `HttpCacheInterceptor` (Cache-Control/ETag/304) · `CustomExceptionFilter` → `application/problem+json` para cualquier error.

## Zod en vez de class-validator

- Un DTO es `export class CreateXDto extends createZodDto(XCreateSchema) {}`. Validación, tipo (`z.output`) y OpenAPI salen del MISMO schema.
- OpenAPI: `@ApiZodBody(schema)`, `@ApiZodQuery(schema)`, `@ApiZodResponse(status, schema, desc?)` — usan `z.toJSONSchema()` nativo. `io: 'input'` para lo que entra (un campo con `default` es opcional) y `'output'` para lo que sale.
- No se usa `nestjs-zod`: su v5.5 declara peers solo hasta NestJS 11.
- `z.object()` descarta claves desconocidas (= `whitelist`); para rechazarlas usar `z.strictObject()`.
- Fechas sin hora: `LocalDateSchema` ('YYYY-MM-DD'), nunca `z.coerce.date()`, que corre el día por UTC.
- Errores de validación: 400 `CVAL-E001` + `errors[{ pointer, path, message, code }]` (RFC 9457 + JSON Pointer). El front los mapea a cada campo.
- Imports de Zod: `import * as z from 'zod'`. Con `import { z }` el front arrastró los ~40 locales (+286 kB).

## Nomenclatura

| Qué | Regla | Ejemplo |
| --- | --- | --- |
| Interface | prefijo `I`; archivo `I<nombre>.interface.ts` o `Ibase.<capa>.ts` | `IPaginatedResult`, `Ibase.service.ts` |
| Type alias | prefijo `T` | `TSubjects`, `TTicketResponse` |
| Enum | prefijo `E` | `EAbility`, `EUserRole` |
| Schema Zod | PascalCase + `Schema` | `TicketCreateSchema` |
| DTO | `Create<X>Dto` · `Update<X>Dto` · `<X>QueryDto`; archivo kebab-case `.dto.ts` | `create-ticket.dto.ts` |
| Constantes | UPPER_SNAKE | `TICKET_STATUS`, `ERROR_CODES` |
| Archivos | kebab-case + rol: `.entity` `.repository` `.service` `.controller` `.module` `-http.module` `.schema` `.guard` `.decorator` `.pipe` `.filter` `.middleware` | |
| Inyección | por constructor, `private readonly` (convención del backend de wallet-api; el `_` de inject() es del front) | `constructor(private readonly ticketsService: TicketsService)` |

### Errores (`common/codes/`) — detalle completo en [docs/standard/error-catalog.md](docs/standard/error-catalog.md)

- `error-codes.ts` (`ERROR_CODES`): `<Capa><Módulo>-E<###>`. Capa `R` repositorio/BD (incluye `DB` por SQLSTATE → `RDB-E<SQLSTATE>`), `S` servicio, `C` controlador/DTO; más `SYS-E999` y `NEST-E<status>`. Mensajes `messageEs`/`messageEn`.
- `validation-errors.ts` (`VALIDATION_ERRORS`): mensajes de validación de DTOs con `{tokens}`. Los schemas Zod los usan con `validationMessage(entry, params)`. **Nunca** un mensaje suelto en un schema.
- Todo error de negocio: `new CustomBusinessException(ERROR_CODES.X.Y, context?)`, nunca un `HttpException` suelto.
- Cuerpo de TODO error: RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `instance` + `code`, `context`, `errors`). Nunca `res.json()` de un error a mano.

## Documentación (obligatoria, en el mismo cambio que el código)

- [docs/README.md](docs/README.md) es el índice.
- Catálogo de errores: `bun run docs:errors` regenera §3 y §4.1. §4.2 (campo → regla → `code` → mensaje por DTO) y §5 (dónde se lanza cada código) van a mano. `error-catalog.docs.spec.ts` falla si el documento no coincide con el código: cada fila de §4.2 se verifica ejecutando el schema real.
- Diccionario de datos: `docs/data-dictionary/<entidad>.md` desde `_template.md` (campos, validaciones, errores del módulo, permisos).
- Referencia de API: Scalar UI (`/api/reference`) generada desde los schemas Zod. Cada endpoint documenta sus errores con `@ApiProblemResponse(status, '<código> · <cuándo>')`.
- Estándares: [rfc-audit.md](docs/standard/rfc-audit.md), [cookies-session.md](docs/standard/cookies-session.md), [http-caching.md](docs/standard/http-caching.md), [authorization.md](docs/standard/authorization.md), [http-status-codes.md](docs/standard/http-status-codes.md).

## Sesión, CSRF y caché

- Sesión **stateful** (express-session): cookie `sid` HttpOnly · SameSite=Lax · Path=/api · 30 min de inactividad (`rolling`) + 7 días de tope. `POST /api/auth/sign-in` regenera la sesión. Usuarios de desarrollo en `users.seed.ts` (contraseña `DEV_PASSWORD`, solo desarrollo).
- Todo es privado por defecto; `@Public()` exime de sesión y CSRF (solo el login, la documentación y `/api/problems`).
- CSRF double-submit: cookie `XSRF-TOKEN` ↔ header `X-XSRF-TOKEN` en POST/PATCH/PUT/DELETE.
- GET → `private, max-age=<@CacheTtl o 0>` + ETag (304). Mutaciones y errores → `no-store`. `If-Match` → 412 `SCONC-E001` (`BaseService.assertIfMatch`).
- En production `loadEnv` exige `REDIS_URL` (sesiones y contadores compartidos entre réplicas) y `TRUST_PROXY=true` detrás de un proxy (si no, todos comparten la IP del proxy y el rate limit los bloquea juntos).
- Rate limit: global por IP (`RATE_LIMIT_GLOBAL_PER_MIN`), por ruta (`@RateLimit`) y por cuenta (`RateLimitService.assertAllowed/recordFailure/reset`). Detalle en `docs/standard/observability.md`.
- `SESSION_SECRET` es obligatorio en production (`loadEnv` falla si se usa el de desarrollo). Nunca secretos en el código ni en los environments del front.

## Permisos (CASL) — detalle en [authorization.md](docs/standard/authorization.md)

- `CaslAbilityFactory.rulesFor(user)` es la ÚNICA fuente de reglas: RBAC (`role_permissions`, editable por ADMIN) + titular (`ownerUuid`: lee y edita lo suyo, NUNCA elimina) + ReBAC (concesiones del titular al alternante, con techo por rol) + autoservicio. El front las recibe por `GET /api/bff/shell` y no las recalcula.
- Nivel TIPO: `@CheckAbility(EAbility.CREATE, 'Ticket')` en el handler (lo evalúa `CaslGuard`).
- Nivel FILA (lectura): `BaseService.readableRowFilter()`. Lo no legible no se lista y su GET responde 404. **Nunca** confiar solo en el guard para leer.
- Nivel REGISTRO (escritura): `BaseService.assertCan()` en update/delete/restore.
- Notificaciones: `NotificationsService.notify()` desde los hooks `onCreated` / `onUpdated` del servicio; nunca lanza.

## Ciclo de vida del ticket y métricas

- Los tickets recorren `new → assigned → in_progress ⇄ pending_customer → resolved → closed` (+ `escalated`, `reopened`). El estado SOLO cambia por `POST /api/tickets/:uuid/transitions` (quién puede cada paso: `lifecycle/ticket-lifecycle.ts`); `PATCH` ya no recibe `status`.
- Todo cambio deja un evento INMUTABLE (`TicketHistoryService.record`); las métricas (FCR, SLA, CSAT) salen SOLO de esos eventos (`sla/ticket-analysis.ts` → `metrics/metrics-engine.ts`). Módulos puros y probados: no leer «el estado de ahora» para calcular un indicador.
- Comentarios solo se agregan (409 `STCK-E002` al intentar editar). Adjuntos: tipo por firma de contenido, ≤ 5 MB. Encuesta CSAT una por ticket al cerrar. Cierre automático a las 48 h (`TicketAutoCloseJob`; en tests se llama `closeStaleResolved(now)`).
- Los estados son variaciones de 3 grupos (`STATUS_GROUPS`: Nuevo · En atención · Cerrado): el tablero BFF devuelve 3 columnas y cada tarjeta trae su estado exacto, `type`, `complexity` (solo la fija el equipo) y `attendedSince` (reloj de la tarjeta).
- Roles: ADMIN (todo; **único que elimina**), SUPERVISOR (asigna, escala y pide información al cliente; no resuelve), AGENT (N1: atiende y resuelve lo asignado, pide información), AUDITOR (solo lectura), VIEWER = CLIENTE (crea y edita lo suyo; no elimina, no asigna ni maneja accesos). Quién mueve qué: `TRANSITIONS` en `lifecycle/ticket-lifecycle.ts`. Definiciones y metas: [docs/standard/metrics.md](docs/standard/metrics.md).
- Fuera de las pruebas el repositorio arranca con tickets de DEMOSTRACIÓN (`buildTicketsSeed`) para que las métricas muestren algo.

- **Recuperar contraseña** (3 formas, ver `docs/data-dictionary/users.md`): enlace por correo (`forgot`/`reset-password`), código del autenticador TOTP o contraseña actual (`POST /api/auth/recover-password`, anti-enumeración `SAUT-E010`, la persona elige la nueva). TOTP en `auth/session/totp.util.ts` (sin dependencias); el secreto se guarda CIFRADO en reposo (AES-256-GCM, `core/crypto/secret-box.ts`, clave `TOTP_ENCRYPTION_KEY`, obligatoria propia en production).
- **Bloqueo de cuenta** (CU07 A3): `LOGIN_MAX_ATTEMPTS` (5) fallos seguidos bloquean la cuenta → 423 `SAUT-E014` con `context.contacts` (administradores); solo `PATCH /api/users/:uuid/status {disabled, locked:false}` (ADMIN) desbloquea. Avisa a administradores (`ACCOUNT_LOCKED`). Detalle y compromisos en `docs/data-dictionary/users.md`.
- **Departamento de origen**: `ticket.department` = código del catálogo editable `ticket-department` (`it` = «TI (interno)»); lo valida el servicio (`STCK-E007`), no un enum. `GET /api/tickets` filtra por `status`, `priority`, `type`, `category` y `department`.
- **CU01 · notificaciones por ticket** ([notifications.md](docs/standard/notifications.md)): `GET /api/tickets?mine=true` («Mis tickets»); `TicketLifecycleService.notifyRequester()` avisa al solicitante en cada cambio de estado (bandeja + SSE + correo) y deja el evento `NOTIFIED` en el historial; tiempo real en `GET /api/notifications/stream` (`@Sse`, `@NoHttpCache()`, latido de 25 s, solo las del usuario de la sesión). `NotificationsService.notify()` devuelve si SE ENVIÓ. Entrega por proceso: una sola réplica.
- **Encuesta (CU02)**: al cerrarse un ticket el solicitante recibe `TICKET_SURVEY` en su buzón (aunque lo haya cerrado él: `allowSelf`): `resolved` (¿se resolvió?), 1–5 y comentario opcional. Una nota baja o un «no se resolvió» avisan a supervisores con `TICKET_SURVEY_ALERT`. **No hay correo** (sin SMTP): los tickets no llaman a `IMailService`; el buzón + SSE es el único canal.
- **Evidencia en bucket (CU02)** ([storage.md](docs/standard/storage.md)): `IObjectStorage` (`core/storage/`, MinIO con `S3_*`; memoria sin `S3_ENDPOINT`, obligatorio en production). Imágenes ≤ 10 MB, documentos (PDF/Excel/CSV/texto) ≤ 25 MB y videos MP4/MOV/WebM ≤ 100 MB y **≤ 5 min** (duración leída de la cabecera: `video-duration.ts`); tipo por FIRMA (`detect-mime.ts`). `transitions` acepta `attachmentIds` (fotos de la solución).
- **Tareas programadas** ([scheduled-jobs.md](docs/standard/scheduled-jobs.md)): `modules/jobs/` (`ScheduledJob`, solo ADMIN; `/api/jobs`). El cierre automático (`ticket-auto-close`) lo configura el administrador (cron, plazo en horas, ejecutar ahora); el planificador corre en el proceso (una réplica). Cron propio de 5 campos en `cron-expression.ts`, zona UTC−6.
- **Descripción del ticket = HTML del editor**: `sanitizeRichText` (`core/sanitize/rich-text.ts`, `sanitize-html`) en `toEntity`/`mergeEntity`; solo formato seguro, enlaces `http(s)`/`mailto`. Nunca guardar ni mostrar la descripción sin pasar por él.

## Despliegue (Dokploy)

`ticketlistbe/Dockerfile` (bun → node 24, `entrypoint.sh` lee `*_FILE` de Docker secrets) y `ticketkanban/Dockerfile` (Angular → Caddy con CSP por hash). Compose, secretos, integración con el compose de wallet-api y checklist en [`deploy/DOKPLOY.md`](../deploy/DOKPLOY.md). En `production`: `SEED_DEMO_DATA` es `false` por defecto (sin usuarios de prueba; las cuentas iniciales salen de `SEED_USERS_JSON` — un arreglo `[{name,email,role,password}]`, una por rol, generado por `deploy/generate-secrets.mjs` — y/o de `BOOTSTRAP_ADMIN_*`) y `loadEnv` exige `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY` y `REDIS_URL` propios.

## Persistencia (TypeORM + Postgres) — detalle en [persistence.md](docs/standard/persistence.md)

- El dominio se guarda en Postgres con **TypeORM** (`src/database/`: `entity-schemas.ts`, `migrations/`, `PersistenceService`). Modelo: las **lecturas** siguen saliendo de la copia en memoria de cada repositorio (el código es síncrono) y cada **escritura** va a una cola ordenada hacia la base; al arrancar cada repositorio se **hidrata** de ella. **Una sola instancia de la API** (dos réplicas divergirían). Sin `DATABASE_URL` (o `DB_PERSISTENCE=false`) todo es en memoria: así corren las pruebas.
- Repositorio nuevo o campo nuevo → actualiza su `EntitySchema` y genera una migración (`bun run migration:generate src/database/migrations/Nombre`, y agrégala a `MIGRATIONS`). **Nunca** `synchronize`, **nunca** editar una migración ya publicada.
- Cada mutación de un repositorio persistente llama a `persist(...)` / `persistence.save(...)`: si agregas un método que cambia datos y no lo haces, el cambio se pierde al reiniciar.
- Semillas idempotentes en cada arranque: permisos, menú y catálogos por clave natural (`ensure`, sin pisar ediciones); usuarios solo si el correo no existe; demostración solo con la tabla vacía.
- `bun run test:pg` (Postgres real) incluye `test/persistence.e2e-spec.ts`: escribe, apaga, arranca otra instancia y verifica que todo se recuperó.
- **Auditoría**: `IAuditLogStore` (memoria o `PostgresAuditLogStore` con `DATABASE_URL`); su tabla `audit_logs` también la crea una migración. Append-only A NIVEL DE API (sin trigger); en producción conviene quitarle UPDATE/DELETE al rol de la app.

## Comandos (`.claude/commands/`)

- `/check` — lint + build + unit + e2e con resumen.
- `/new-module <recurso> <COD>` — scaffold de un módulo de dominio en capas con Zod (incluye su documentación).
