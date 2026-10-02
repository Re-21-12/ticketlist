# users — Diccionario de datos

> Basado en `src/modules/users/users.seed.ts` (`ISessionUser`) y `users.repository.ts`.
> Administración (`/api/users`): listar, ver, cambiar rol y deshabilitar/habilitar. Alta solo por registro público; no se borran.

## Descripción

Personas que inician sesión. El `role` define su RBAC (`role_permissions`). La contraseña se guarda
como hash `scrypt` con sal, y se verifica con `timingSafeEqual`.

## Campos

| Columna (BD) | Campo | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador (lo guarda la sesión) |
| `name` | `name` | `varchar(120)` | NO | — | — | Nombre visible |
| `email` | `email` | `varchar(254)` | NO | — | UNIQUE, minúsculas | Login y regla `ASSIGNED_TO_ME` |
| `role` | `role` | `enum` | NO | — | `ADMIN` \| `AGENT` \| `VIEWER` | Rol RBAC |
| `password_hash` | — (nunca sale del repositorio) | `text` | NO | — | `scrypt` + sal NUEVA en cada cambio | Credencial |
| `email_verified_at` | — (no sale en el shell) | `timestamptz` | SÍ | NULL | `NULL` = sin verificar: **no puede iniciar sesión** (`SAUT-E008`) | Cuándo confirmó su correo (enlace de verificación o restablecer contraseña) |
| `disabled_at` | `disabled` (bool) | `timestamptz` | SÍ | NULL | `NULL` = activa. Deshabilitada: no inicia sesión (401 genérico) y sus sesiones se cierran | Baja reversible de la cuenta |
| `created_at` | `createdAt` | `timestamptz` | NO | `now()` | — | Alta |
| `avatar_icon` | `avatarIcon` | `varchar(20)` | SÍ | NULL | uno de `AVATAR_ICONS` (`pi-star`…) | Ícono del avatar; `NULL` = iniciales |
| `avatar_color` | `avatarColor` | `char(7)` | SÍ | NULL | uno de `AVATAR_COLORS` (hex con contraste ≥ 4.5:1 con blanco) | Fondo del avatar; `NULL` = color del tema |

## Validaciones (DTO Zod) — `SignInDto`

| Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|
| `email` | `email()` | `GENERIC.IS_EMAIL` |
| `password` | `min(8)` | `GENERIC.MIN_LENGTH` |

## Validaciones (DTO Zod) — perfil

| DTO | Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|
| `ChangePasswordDto` | `currentPassword` | `min(1)` | `PASSWORD.CURRENT_REQUIRED` |
| `ChangePasswordDto` | `newPassword` | 8–128 + mayúscula, minúscula, número y símbolo | `GENERIC.MIN_LENGTH`, `GENERIC.MAX_LENGTH`, `PASSWORD.MISSING` |
| `UpdateAvatarDto` | `avatarIcon`, `avatarColor` | enum de lista cerrada, `nullable` | `GENERIC.REQUIRED_SELECTION` |

## Validaciones (DTO Zod) — alta y recuperación

| DTO | Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|
| `SignUpDto` | `name` | 3–120 (tras `trim`) | `GENERIC.MIN_LENGTH`, `GENERIC.MAX_LENGTH` |
| `SignUpDto` | `email` | `email()`, minúsculas | `GENERIC.IS_EMAIL` |
| `SignUpDto` | `password` | 8–128 + las cuatro clases | `GENERIC.MIN_LENGTH`, `GENERIC.MAX_LENGTH`, `PASSWORD.MISSING` |
| `SignUpDto` | (otras claves) | `strictObject`: no se puede elegir el rol | — |
| `VerifyEmailDto` / `ResetPasswordDto` | `token` | 20–128 caracteres base64url | `ACCOUNT.TOKEN_REQUIRED` |

## Validaciones (DTO Zod) — administración

| DTO | Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|
| `AdminUserQueryDto` | `page`, `take`, `search` | paginación base | `PAGINATION.*` |
| `AdminUserQueryDto` | `role` | enum opcional | — |
| `UpdateUserRoleDto` | `role` | enum; `strictObject` (ninguna otra clave) | — |
| `UpdateUserStatusDto` | `disabled` | boolean; `strictObject` | — |

## Permisos

`User` en CASL: `read` (listar/ver), `update` (rol y estado). Por defecto solo ADMIN (`manage all`). Reglas que no
dependen del rol configurado: nadie cambia **su propio** rol ni se deshabilita; siempre queda **un administrador activo**.
Un cambio de rol rige desde la siguiente request del usuario; deshabilitar cierra todas sus sesiones.

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `SAUT-E004` | 401 | POST `/api/auth/sign-in` | Correo inexistente o contraseña incorrecta (misma respuesta) |
| `SUSR-E001` | 409 | POST `/api/auth/sign-up` | Ya existe una cuenta con ese correo |
| `SUSR-E002` | 404 | GET/PATCH `/api/users/:uuid…` | Usuario inexistente |
| `SUSR-E003` | 409 | PATCH `/:uuid/role` · `/:uuid/status` | Sobre la propia cuenta |
| `SUSR-E004` | 409 | PATCH `/:uuid/role` · `/:uuid/status` | Dejaría el sistema sin administrador activo |
| `SAUT-E008` | 403 | POST `/api/auth/sign-in` | Contraseña correcta, correo sin verificar |
| `SAUT-E009` | 400 | POST `/api/auth/verify-email` · `/reset-password` | Token inexistente, usado o vencido |
| `SAUT-E014` | 423 | POST `/api/auth/sign-in` | Cuenta bloqueada por intentos fallidos; el cuerpo trae `context.contacts` para pedir el desbloqueo |
| `SAUT-E010` | 401 | POST `/api/auth/recover-password` | Código TOTP o contraseña actual incorrectos, cuenta inexistente o sin autenticador (misma respuesta) |
| `SAUT-E011` / `E012` / `E013` | 422 / 409 / 409 | POST `/api/auth/totp/enable` · `/setup` | Código de alta incorrecto · sin alta en curso · autenticador ya activo |

## Cuentas iniciales de producción (una por rol)

Sin datos de demostración (`SEED_DEMO_DATA=false`, el valor por defecto en `production`), los usuarios salen de `SEED_USERS_JSON`: `[{ name, email, role, password }]` con `role` ∈ `ADMIN | SUPERVISOR | AGENT | AUDITOR | VIEWER`, clave ≥ 12 caracteres y correos únicos (validado al arrancar; si no hay ningún ADMIN —ni `BOOTSTRAP_ADMIN_PASSWORD`— la API no arranca). Llega como secreto (`SEED_USERS_JSON_FILE`) y lo genera `deploy/generate-secrets.mjs` con claves aleatorias. Los permisos por rol, el menú y los catálogos se siembran siempre desde el código.

## Alta sin confirmación por correo

El registro público (`POST /api/auth/sign-up`) deja la cuenta **activa y verificada al instante** (siempre `VIEWER`): no se envía correo ni hay enlace de verificación. `verify-email` y `resend-verification` siguen existiendo por compatibilidad pero no hacen falta (no hay cuentas sin verificar).

## Bloqueo por intentos fallidos (CU07, A3)

`failedLogins` (intentos seguidos fallidos; un acierto lo reinicia) y `lockedAt`. Al llegar a `LOGIN_MAX_ATTEMPTS` (5) la cuenta queda
**bloqueada**: todo inicio de sesión responde 423 `SAUT-E014` con la información de contacto de los administradores (`context.contacts`)
y NO se mira la contraseña; tampoco se recupera con TOTP/contraseña actual. Se avisa a los administradores (`ACCOUNT_LOCKED`).
**Solo un administrador la desbloquea**: `PATCH /api/users/:uuid/status` con `{ disabled, locked: false }` (el vista administrativa trae
`locked` y `lockedAt`). Compromiso conocido: quien adivina un correo puede bloquear esa cuenta (denegación de servicio dirigida) y el
423 confirma que el correo existe; es lo que pide el requisito, y el límite por IP y por cuenta de `/api/auth/sign-in` sigue vigente.

## Autenticador (TOTP, segundo factor de recuperación)

Campos internos de la cuenta (nunca salen en el shell ni en la vista administrativa): `totpSecret` (activo, base32 de 160 bits, CIFRADO en reposo con AES-256-GCM y `TOTP_ENCRYPTION_KEY`), `totpPendingSecret` (generado, sin confirmar) y `totpLastStep` (último paso de 30 s aceptado:
un código no se reutiliza). Endpoints de la propia cuenta: `GET /api/auth/totp`, `POST /totp/setup` (secreto + `otpauth://`, se muestra
UNA vez), `POST /totp/enable {code}` y `POST /totp/disable {currentPassword}`. Recuperación pública: `POST /api/auth/recover-password`
con `method: 'totp' | 'current_password'`; la persona elige su contraseña nueva, se cierran todas sus sesiones, 5 fallos por cuenta
cada 15 min bloquean (429) y todo fallo responde igual (`SAUT-E010`). Implementación RFC 6238 propia en `session/totp.util.ts`
(probada con los vectores del RFC).
| `SAUT-E006` | 422 | PATCH `/api/auth/password` | La contraseña actual no coincide |
| `SAUT-E007` | 422 | PATCH `/api/auth/password` | La nueva es igual a la actual |
| `SRTL-E001` | 429 | PATCH `/api/auth/password` | 5 contraseñas actuales equivocadas en 15 min (por cuenta) |

## Semilla de desarrollo

Ver [cookies-session.md](../standard/cookies-session.md#usuarios-de-desarrollo). La contraseña de desarrollo nunca se usa en producción.
