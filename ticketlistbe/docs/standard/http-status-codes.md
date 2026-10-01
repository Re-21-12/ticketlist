# HTTP Status Codes — semántica (RFC 9110 §15)

> Qué status codes emite ticketlistbe y con qué semántica (port de `docs/standard/http-status-codes.md`
> de wallet-api). Códigos de error y mensajes: [error-catalog.md](error-catalog.md).
> Test de regresión: `test/app.e2e-spec.ts`.

## Repertorio

| Código | Nombre | Cuándo (RFC 9110) | En este repo |
|---|---|---|---|
| **200** | OK | Request exitoso | GET, PATCH (incluido `/notifications/:uuid/read`), `POST /api/auth/sign-in` (devuelve el shell) |
| **201** | Created | Recurso creado — §15.3.3 | POST de tickets, relaciones y permisos por rol |
| **204** | No Content | Éxito sin body — §15.3.5 | DELETE, PATCH `/restore`, `POST /api/auth/sign-out` |
| **304** | Not Modified | `If-None-Match` coincide con el ETag vigente — §15.4.5 | todo GET ([http-caching.md](http-caching.md)) |
| **400** | Bad Request | Request inválido — §15.5.1 | `CVAL-E001` (validación Zod), `RDB-E23502`, `RDB-E22001` |
| **401** | Unauthorized | Sin credenciales válidas — §15.5.2 | `SAUT-E002` (sin sesión o expirada), `SAUT-E004` (login inválido), `SAUT-E005` (tope de 7 días) |
| **403** | Forbidden | Autenticado pero sin permiso — §15.5.4 | `SAUT-E001` (CASL), `SAUT-E003` (CSRF), `SREL-E004` (el alternante intenta cambiar las reglas) |
| **404** | Not Found | Recurso inexistente — §15.5.5 | `RTCK-E001`, `RREL-E001`, `RRPM-E001`, `RNTF-E001`; también un recurso **no legible** para el usuario (no se revela que existe); HEAD sin recurso |
| **409** | Conflict | Estado conflictivo — §15.5.10 | `RTCK-E003`, `SREL-E003`, `RRPM-E002`, `RDB-E23503`, `RDB-E23505` |
| **410** | Gone | Existió pero ya no está — §15.5.11 | `RTCK-E002` (borrado lógico) |
| **412** | Precondition Failed | `If-Match` no coincide — §15.5.13 | `SCONC-E001` (concurrencia optimista) |
| **422** | Unprocessable Content | Semánticamente inválido — §15.5.21 | `SREL-E001`, `SREL-E002`, `RDB-E23514` |
| **500** | Internal Server Error | Fallo no recuperable — §15.6.1 | `SYS-E999` |

**401 vs 403** (mismo criterio que wallet-api): `401` = no sé quién eres (el front vuelve a iniciar
sesión); `403` = sé quién eres y no puedes. Todo error viaja como `application/problem+json`
(RFC 9457, [error-catalog.md §2](error-catalog.md#2-cómo-se-resuelve-un-error)).

## CRUD base (`src/core/base.controller.ts` + controladores concretos)

| Endpoint | Método | Status de éxito |
|---|---|---|
| `findAll` | GET `/` | 200 |
| `findOneByUuid` | GET `/:uuid` | 200 |
| `existsByUuid` | HEAD `/:uuid` | 200 / 404 |
| `create` | POST `/` | **201** (`@HttpCode(HttpStatus.CREATED)`) |
| `update` | PATCH `/:uuid` | 200 |
| `softDeleteByUuid` | DELETE `/:uuid` | **204** |
| `restoreByUuid` | PATCH `/:uuid/restore` | **204** |

## Centralización

`src/common/filters/exception-filter.filter.ts` es el **único** lugar que traduce una excepción a
status. El orden de resolución y el cuerpo Problem Details están en [error-catalog.md §2](error-catalog.md#2-cómo-se-resuelve-un-error).
