# users — Diccionario de datos

> Basado en `src/modules/users/users.seed.ts` (`ISessionUser`) y `users.repository.ts`.
> Hoy no hay CRUD de usuarios: son semilla de desarrollo.

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

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `SAUT-E004` | 401 | POST `/api/auth/sign-in` | Correo inexistente o contraseña incorrecta (misma respuesta) |
| `SAUT-E006` | 422 | PATCH `/api/auth/password` | La contraseña actual no coincide |
| `SAUT-E007` | 422 | PATCH `/api/auth/password` | La nueva es igual a la actual |
| `SRTL-E001` | 429 | PATCH `/api/auth/password` | 5 contraseñas actuales equivocadas en 15 min (por cuenta) |

## Semilla de desarrollo

Ver [cookies-session.md](../standard/cookies-session.md#usuarios-de-desarrollo). La contraseña de desarrollo nunca se usa en producción.
