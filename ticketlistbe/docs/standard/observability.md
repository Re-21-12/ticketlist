# Observabilidad, plataforma y operación

> Port de `wallet-api/docs/standard/observability.md` y `graceful-shutdown.md`. Código:
> `src/core/observability/`, `src/core/health/`, `src/core/kv/`, `src/core/rate-limit/`,
> `src/common/http/method-not-allowed.middleware.ts`. Tests: `test/platform.e2e-spec.ts`,
> `src/core/kv/kv-store.contract.spec.ts`.

## 1. Almacén clave-valor (memoria / Redis)

Todo lo efímero (sesiones, contadores de rate limit, tokens de un solo uso, pub/sub de SSE) pasa por
`IKeyValueStore`. Hay dos adaptadores y la **misma batería de tests** corre contra los dos
(`kv-store.contract.spec.ts`): si ambos pasan, son intercambiables.

| | `MemoryKvStore` | `RedisKvStore` |
|---|---|---|
| Se elige cuando | no hay `REDIS_URL` | hay `REDIS_URL` |
| Pensado para | desarrollo y tests (sin Docker) | producción y varias réplicas |
| Persiste al reiniciar | no | sí (sesiones incluidas) |
| Claves | tal cual | prefijo `ticketit:` (convive con otras apps) |

`loadEnv()` **exige `REDIS_URL` en production**: sin Redis, cada réplica tendría sus propias
sesiones y sus propios contadores, y el rate limit sería inútil.

```bash
docker compose up -d          # Postgres :5433 + Redis :6380 (puertos propios)
REDIS_URL=redis://localhost:6380 bun run start:dev
bun run test:redis            # unit + e2e contra Redis real
```

## 2. `X-Request-Id` y logs

| Qué | Regla |
|---|---|
| Id de la request | Se respeta el `X-Request-Id` entrante **solo si** cumple `^[A-Za-z0-9._-]{8,64}$`; si no, se genera un UUID. Nunca se refleja texto arbitrario. |
| Respuesta | Siempre lleva `X-Request-Id` (también los 401/403/429 que corta un guard). El front lo muestra al reportar un error. |
| Log | Una línea JSON por request, al terminar: `{ requestId, method, path, status, durationMs, userUuid }`. Nivel `error` ≥ 500, `warn` ≥ 400, `log` el resto. |
| Qué NO se loguea | Query string, body, cabeceras ni cookies (pueden traer tokens o datos personales). |
| En tests | Apagado (`NODE_ENV=test`). |

Es un **middleware** y no un interceptor a propósito: un interceptor corre después de los guards y no
vería lo que ellos rechazan.

## 3. Rate limiting

Detalle de los límites por cuenta en [auth-flows.md §7](../design/auth-flows.md#7-rate-limiting).

- **Por IP, global** (`RateLimitGuard`): `RATE_LIMIT_GLOBAL_PER_MIN` (300 por defecto). Es el **primer** guard, antes que la sesión.
- **Por ruta**: `@RateLimit({ limit, windowSeconds })` — más estricto, por IP + ruta.
- **Sin límite**: `@SkipRateLimit()` (health checks).
- **Por cuenta**: `RateLimitService.assertAllowed / recordFailure / reset` desde los servicios de autenticación.
- Cada respuesta lleva `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` (IETF *RateLimit header fields*).
- El 429 es Problem Details `SRTL-E001` con `context.retryAfterSeconds` y la cabecera `Retry-After` (RFC 9110 §10.2.3).
- Detrás de un proxy hay que activar `TRUST_PROXY=true`; si no, **todos los usuarios comparten la IP del proxy** y se bloquean entre sí.

## 4. Health checks

| Ruta | Pregunta | Si falla |
|---|---|---|
| `GET /api/health` | ¿el proceso responde? (*liveness*) | el orquestador reinicia el contenedor |
| `GET /api/health/ready` | ¿responden sus dependencias? (*readiness*) | 503 → se le quita tráfico, sin reiniciarlo |

Públicas y sin rate limit. Al conectar PostgreSQL, `ready` agrega el `SELECT 1`.

## 5. Apagado ordenado

Con `app.enableShutdownHooks()` (en `main.ts`), `SIGTERM` dispara `onApplicationShutdown`:

1. Se dejan de aceptar conexiones nuevas y se cierran las ociosas.
2. A las que siguen en vuelo se les da `DRAIN_TIMEOUT_MS` (10 s) y luego se cortan.
3. Se cierra el almacén clave-valor (y, más adelante, los streams SSE).

Así un despliegue no corta a nadie a mitad de una request.

## 6. 405 Method Not Allowed

Si la ruta existe pero no con ese método, la respuesta es `405` con la cabecera `Allow` (RFC 9110
§15.5.6), no el `404` que Nest devuelve por defecto. Una ruta que no existe sigue siendo `404`.
