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

- `CaslAbilityFactory.rulesFor(user)` es la ÚNICA fuente de reglas: RBAC (`role_permissions`, editable por ADMIN) + titular (`ownerUuid`) + ReBAC (concesiones del titular al alternante, con techo por rol) + autoservicio. El front las recibe por `GET /api/bff/shell` y no las recalcula.
- Nivel TIPO: `@CheckAbility(EAbility.CREATE, 'Ticket')` en el handler (lo evalúa `CaslGuard`).
- Nivel FILA (lectura): `BaseService.readableRowFilter()`. Lo no legible no se lista y su GET responde 404. **Nunca** confiar solo en el guard para leer.
- Nivel REGISTRO (escritura): `BaseService.assertCan()` en update/delete/restore.
- Notificaciones: `NotificationsService.notify()` desde los hooks `onCreated` / `onUpdated` del servicio; nunca lanza.

## Persistencia

`InMemoryRepository` implementa `IBaseRepository` (mismo contrato que wallet-api). Pasar a TypeORM/Drizzle = reemplazar el repositorio y poner decoradores de columna en `BaseEntity`; servicio y controlador no cambian.

## Comandos (`.claude/commands/`)

- `/check` — lint + build + unit + e2e con resumen.
- `/new-module <recurso> <COD>` — scaffold de un módulo de dominio en capas con Zod (incluye su documentación).
