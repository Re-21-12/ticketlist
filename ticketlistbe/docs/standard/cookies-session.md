# Sesión stateful y cookies (RFC 6265) + CSRF

> Mismo modelo que wallet-api (`docs/standard/cookies.md`, `docs/security/csrf-y-cookies-compliance.md`).
> Código: `src/config/session.config.ts`, `src/modules/auth/session/*`.
> Tests de regresión: `test/app.e2e-spec.ts` → «Sesión y cookies».

## Por qué stateful

El estado de la sesión vive en el **servidor** (store). La cookie solo transporta un id opaco
firmado. Frente a un JWT en el navegador:

- **Revocación inmediata:** `sign-out` o expiración destruyen la sesión en el store, sin blacklist.
- **Nada sensible en el cliente:** ni rol ni permisos viajan en la cookie.
- **Permisos siempre frescos:** cada request recalcula el Ability desde `role_permissions` y las relaciones vigentes.

## Cookies emitidas

| Cookie | Atributos | Para qué | Estrictamente necesaria |
|---|---|---|---|
| `sid` | `HttpOnly`, `SameSite=Lax`, `Path=/api`, `Secure` en production, expira a los 30 min de inactividad (`rolling`) | id opaco de la sesión | Sí (autenticación) |
| `XSRF-TOKEN` | **sin** `HttpOnly` (el front debe leerla), `SameSite=Lax`, `Path=/`, 7 días | token CSRF double-submit | Sí (seguridad) |

Solo existen cookies estrictamente necesarias: igual que en wallet-api, **no aplica** el banner de
consentimiento de ePrivacy/GDPR. Revisar si se agrega analítica o tracking.

## Ciclo de vida

| Evento | Qué pasa | Dónde |
|---|---|---|
| `POST /api/auth/sign-in` | `scrypt` + `timingSafeEqual`. `session.regenerate()` (anti fijación). Se guarda `userUuid` + `authenticatedAt`. Nuevo `XSRF-TOKEN`. Responde el shell del BFF | `AuthSessionService.signIn` |
| Cada request | `SessionContextMiddleware` publica el usuario en `RequestContext`. `rolling` renueva la expiración de la cookie | middleware global |
| Inactividad > 30 min | la cookie expira → 401 `SAUT-E002` | navegador + store |
| > 7 días desde el login | la sesión se destruye aunque haya actividad → 401 `SAUT-E005` | `SessionAuthGuard` |
| `POST /api/auth/sign-out` | `session.destroy()` + borra `sid` y `XSRF-TOKEN` | `AuthSessionService.signOut` |

## Mis sesiones y cambio de contraseña

Detalle del diseño en [auth-flows.md §6](../design/auth-flows.md#6-gestión-de-sesiones). Implementado:

| Endpoint | Qué hace |
|---|---|
| `GET /api/auth/sessions` | Sesiones vivas del usuario (IP, navegador, inicio, vencimiento); la actual marcada y primera |
| `DELETE /api/auth/sessions/:id` | Cierra UNA sesión ajena (404 si no es suya; 422 `SSES-E001` si es la actual) |
| `POST /api/auth/sessions/revoke-others` | Cierra todas menos la actual |
| `PATCH /api/auth/password` | Cambia la contraseña y **cierra todas las demás sesiones** |

- El `id` de una sesión es un **hash** del `sid` (`publicSessionId`), nunca el `sid`: exponer el `sid` anularía el `HttpOnly` de la cookie.
- Índice `user-sessions:{userUuid}` (conjunto de `sid`) sobre el almacén clave-valor; las sesiones vencidas se podan al listar.
- Ningún endpoint recibe un `userUuid`: solo se opera sobre el usuario de la sesión.
- La contraseña actual se verifica con `timingSafeEqual`; 5 fallos por cuenta en 15 min → 429 (`RateLimitService.assertAllowed/recordFailure/reset`).

## CSRF (double-submit cookie)

En todo método no seguro (POST/PATCH/PUT/DELETE), `CsrfGuard` exige `X-XSRF-TOKEN` igual a la
cookie `XSRF-TOKEN`. Si no coincide: 403 `SAUT-E003`. Un sitio atacante puede hacer que el
navegador **envíe** la cookie, pero no puede **leerla** para copiarla al header.

- Angular `HttpClient` lo hace solo (lee `XSRF-TOKEN`, envía `X-XSRF-TOKEN` en mutaciones a URLs relativas).
- `SameSite=Lax` es la segunda barrera: la cookie `sid` no viaja en POST cross-site.
- Exento: `@Public()` (el login, que todavía no tiene sesión). Un login-CSRF solo perjudica al atacante (mismo criterio que wallet-api).

## Usuarios de desarrollo

Contraseña de todos: `ticketit-dev` (`src/modules/users/users.seed.ts`).

| Correo | Rol |
|---|---|
| `marta@ticketit.dev` | ADMIN |
| `ana@ticketit.dev` | AGENT |
| `luis@ticketit.dev` | AGENT |
| `victor@ticketit.dev` | VIEWER |

## Producción (pendiente)

- Store Redis (`connect-redis`), como wallet-api.
- `SESSION_SECRET` propio: `loadEnv()` impide arrancar en production con el de desarrollo.
- `trust proxy` activo en production, para que `Secure` funcione detrás de un proxy TLS.
