# Auditoría RFC — lineamiento heredado de wallet-api y estado en ticketlistbe

> Fecha: 2026-09-29. Fuente del lineamiento: `wallet-api/docs/standard/*.md`,
> `wallet-api/docs/security/csrf-y-cookies-compliance.md` y `wallet-api/docs/plan/estrategia-implementacion.md`.
> Cada fila de ticketlistbe cita su test de regresión: si el test pasa, la conformidad está verificada,
> no solo declarada.

## 1. Resumen

| RFC / estándar | Tema | wallet-api | ticketlistbe | Evidencia en ticketlistbe |
|---|---|---|---|---|
| **RFC 9457** | Problem Details (cuerpo de error) | ❌ **Pendiente** (issue #178, cuerpo propio `statusCode/error/errorCode`) | ✅ `application/problem+json` en TODO error | e2e «Problem Details (RFC 9457)» |
| RFC 6901 | JSON Pointer (ubicar el campo inválido) | ❌ (sin detalle por campo estructurado) | ✅ `errors[].pointer` (`#/title`) | e2e «400 de validación con errors[] y JSON Pointer» |
| RFC 9110 §15 | Semántica de status codes | ✅ `http-status-codes.md` | ✅ [http-status-codes.md](http-status-codes.md) | e2e (201/204/304/400/401/403/404/409/412/422) |
| RFC 9110 §8.8.3 | ETag fuerte y opaco | ✅ `sha256(uuid:updatedAt)` | ✅ `sha256(representación JSON)` | e2e «GET → Cache-Control private + ETag» |
| RFC 9110 §13 | Condicionales: `If-None-Match` → 304, `If-Match` → 412 | ✅ | ✅ | e2e «If-None-Match → 304», «If-Match … → 412 SCONC-E001» |
| RFC 9111 | Caché HTTP (`Cache-Control`) | ✅ `private, max-age=<ttl>` en GET; mutaciones sin header | ✅ igual en GET + **`no-store` explícito** en mutaciones y errores | e2e (`private, max-age=0`, `no-store`) |
| RFC 6265 (+ 6265bis) | Cookies de sesión | ✅ `sid` HttpOnly, SameSite=Lax, Path=/api, Secure en prod, 30 min rolling + 7 d absoluto | ✅ mismo modelo | e2e «cookie sid: HttpOnly, SameSite=Lax, Path=/api…» |
| OWASP CSRF | Double-submit cookie | ✅ `XSRF-TOKEN` ↔ `X-XSRF-TOKEN` | ✅ mismo patrón + comparación en tiempo constante | e2e «mutación sin X-XSRF-TOKEN → 403 SAUT-E003» |
| OWASP Session | Fijación de sesión (regenerar id al autenticar) | ✅ | ✅ `session.regenerate()` en el login | `AuthSessionService.signIn` |
| RFC 9110 §5.6.7 | `Date` en IMF-fixdate | ✅ (lo emite Express) | ✅ (lo emite Express, no se toca) | — (sin override: mismo argumento que wallet-api) |
| RFC 6749 §10.12 | `state` anti-CSRF en OAuth | ✅ (Google OAuth) | ➖ No aplica (sin OAuth todavía) | — |
| RFC 6238 | TOTP (MFA) | ✅ | ➖ No aplica (sin MFA todavía) | — |
| RFC 8030 | Web Push | ✅ | ➖ No aplica (notificaciones solo in-app) | — |

## 2. Hallazgos y decisiones

### 2.1 RFC 9457 — el gap principal de wallet-api, corregido aquí

wallet-api responde errores con un cuerpo propio y tiene la migración planificada (issue #178, S3 del
plan). ticketlistbe nace en el estándar (detalle en [error-catalog.md §2](error-catalog.md#2-cómo-se-resuelve-un-error)):

- **Media type** `application/problem+json` (§3). Los clientes genéricos (gateways, SDKs) ya saben leerlo.
- **`type` desreferenciable** (§3.1.1): `/api/problems/<código>` responde la entrada del catálogo. En wallet-api el código no se puede consultar desde la API.
- **`title` estable por tipo y `detail` por ocurrencia** (§3.1.3–3.1.4). En wallet-api `error` mezcla ambos.
- **Extensiones** (§3.2): `code` (catálogo `<Capa><Módulo>-E###`, compatible con wallet-api), `context`, `errors[]` con JSON Pointer.

**Recomendación para wallet-api (#178):** portar `common/filters/exception-filter.filter.ts`,
`core/dtos/problem-details.dto.ts` y `common/problems/`. Tratarlo como cambio de contrato: el front
lee `title` en vez de `error` y `code` en vez de `errorCode`.

### 2.2 `no-store` explícito en mutaciones y errores (mejora sobre wallet-api)

wallet-api no emite `Cache-Control` en mutaciones y errores: confía en que no se cachean por
defecto. RFC 9111 §4.2.2 permite caché heurística de algunas respuestas sin validadores. Aquí se
declara `no-store` explícito: una respuesta de error o de escritura nunca queda en un caché.

### 2.3 ETag sobre la representación (diferencia deliberada)

wallet-api calcula el ETag con `uuid + updatedAt`, que solo sirve para ítems. Aquí se hashea la
representación JSON, así también cubre listados y respuestas del BFF. El mismo cálculo se usa para
`If-Match` (`BaseService.assertIfMatch`), así que el ETag de un GET sirve tal cual para el PATCH.

### 2.4 Autorización a nivel de fila (bug encontrado durante esta auditoría)

El guard CASL evalúa por **tipo**: `can('read', 'Ticket')` es verdadero si existe cualquier regla de
lectura, incluida «solo las mías». Sin filtro por fila, un usuario sin permiso de rol pero con la
regla de titular veía **todas** las filas. Se corrigió en `BaseService.readableRowFilter()`: listados y
lecturas evalúan cada fila con el mismo Ability, y lo no legible responde 404 (no revela que existe).
Test: e2e «solo ADMIN gestiona permisos, y un cambio rige desde la siguiente request».

> En wallet-api este riesgo está mitigado por `getReadScope()` (filtro por dueño en el servicio)
> **y** RLS de PostgreSQL. Conviene revisar allá cualquier servicio que no sobreescriba
> `getReadScope()` y dependa solo del guard.

## 3. Pendientes

| # | Pendiente | Por qué no se hizo ahora |
|---|---|---|
| 1 | Store de sesión en Redis (`connect-redis`) | En desarrollo basta `MemoryStore`. En producción es obligatorio: sin Redis, varias réplicas no comparten sesión. |
| 2 | `Secure` + `__Host-` prefix en la cookie | `Secure` ya se activa en production. `__Host-` exige `Path=/`, incompatible con `Path=/api`; se decide al definir el dominio real. |
| 3 | RLS en BD (defensa en profundidad de wallet-api) | Sin BD real todavía. Al conectar PostgreSQL, replicar las políticas `_owner` / `_alternante_*` de wallet-api. |
| 4 | Rate limiting del login (RFC 6585 `429`) | wallet-api lo tiene con `@nestjs/throttler`; aquí falta. |
