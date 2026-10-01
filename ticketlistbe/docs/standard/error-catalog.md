# Catálogo de errores — códigos, capas y mensajes

> Referencia de TODOS los errores que emite ticketlistbe: formato del código, qué capa lo lanza,
> mensajes (es/en), el cuerpo **RFC 9457 (Problem Details)** y el mapeo campo → regla → mensaje
> de cada DTO.
> Fuentes en código: `src/common/codes/error-codes.ts` (negocio, BD, sistema) y
> `src/common/codes/validation-errors.ts` (validación de DTOs).
> Test de regresión: `src/common/codes/error-catalog.docs.spec.ts` (el test falla si este
> documento no coincide con el código).

## 1. Formato del código

`<Capa><Módulo>-E<###>` — mismo formato que wallet-api.

| Capa | Prefijo | Qué representa | Dónde se lanza |
|---|---|---|---|
| Repositorio / BD | `R` | Acceso a datos: no encontrado, ya eliminado, constraint de PostgreSQL | `BaseService.findOrFail`, `CustomExceptionFilter` (SQLSTATE → `RDB-E<SQLSTATE>`) |
| Servicio | `S` | Regla de negocio o autorización | `BaseService.assertCan`, `CaslGuard`, servicios de módulo |
| Controlador / DTO | `C` | Request inválido (validación Zod de body, query o params) | `ZodValidationPipe` → `CustomExceptionFilter` |
| Sistema | `SYS` / `NEST` | No mapeado (500) o `HttpException` de Nest sin código propio | `CustomExceptionFilter` |

- **Módulo:** 3 letras (`TCK` tickets, `VAL` validación, `AUT` autorización, `DB` base de datos).
- **Número:** secuencial por módulo y capa. En `RDB` el número es el SQLSTATE de PostgreSQL.
- Todo error de negocio se lanza como `new CustomBusinessException(ERROR_CODES.X.Y, context?)`, nunca con un `HttpException` suelto.

## 2. Cómo se resuelve un error

`src/common/filters/exception-filter.filter.ts` (`APP_FILTER` global) es el **único** lugar que
traduce una excepción a status + cuerpo. Orden:

| # | Excepción | Resultado |
|---|---|---|
| 1 | `ZodError` (del `ZodValidationPipe` o de un `parse` de respuesta) | 400 `CVAL-E001` + `errors[]` (JSON Pointer) |
| 2 | `CustomBusinessException` | `httpStatus` y `code` del catálogo |
| 3 | Error de BD con `driverError.code` mapeado en `ERROR_CODES.DB` | status/código de la tabla `RDB-*` |
| 4 | `HttpException` de Nest | su status, código `NEST-E<status>` |
| 5 | Cualquier otro | 500 `SYS-E999` (se loguea con stack) |

Idioma: `Accept-Language` con `es` → `messageEs`; si no, `messageEn` (respuesta con `Vary: Accept-Language`).
Los mensajes de **validación** salen siempre en español, igual que en wallet-api.

### Cuerpo — RFC 9457 Problem Details (`application/problem+json`)

wallet-api usa un cuerpo propio (`statusCode`, `error`, `errorCode`) y tiene la migración a RFC 9457
pendiente (issue #178). ticketlistbe nace en el estándar:

| Miembro | RFC 9457 | Valor en ticketlistbe |
|---|---|---|
| `type` | §3.1.1 — URI que identifica el tipo de problema | `/api/problems/<código>`, **desreferenciable**: `GET` devuelve la entrada del catálogo |
| `title` | §3.1.3 — resumen del TIPO, estable entre ocurrencias | mensaje del catálogo (`messageEs`/`messageEn` según `Accept-Language`) |
| `status` | §3.1.2 — mismo status HTTP | igual al de la respuesta |
| `detail` | §3.1.4 — explicación de ESTA ocurrencia | p. ej. «2 campo(s) inválido(s)», mensaje de Nest |
| `instance` | §3.1.5 — URI de la ocurrencia | la URL de la request |
| `code` | extensión (§3.2) | código del catálogo `<Capa><Módulo>-E<###>` |
| `timestamp` | extensión | ISO-8601 UTC |
| `context` | extensión | `IErrorContext` (`uuid`, `entity`, `field`…) o `null` |
| `errors` | extensión, solo `CVAL-E001` | `[{ pointer, path, message, code }]`. `pointer` = JSON Pointer (RFC 6901) al campo |

Toda respuesta de error lleva `Cache-Control: no-store` y `Vary: Accept-Language`.

```jsonc
// HTTP/1.1 400 Bad Request
// Content-Type: application/problem+json
{
  "type": "/api/problems/CVAL-E001",
  "title": "Datos inválidos",
  "status": 400,
  "detail": "2 campo(s) inválido(s)",
  "instance": "/api/tickets",
  "code": "CVAL-E001",
  "timestamp": "2026-09-29T12:00:00.000Z",
  "context": null,
  "errors": [
    { "pointer": "#/title", "path": "title", "message": "El título debe tener al menos 3 caracteres", "code": "too_small" },
    { "pointer": "#/otherCategoryDetail", "path": "otherCategoryDetail", "message": "Describe la categoría", "code": "custom" }
  ]
}
```

<!-- error-catalog:generated:start -->
<!-- NO editar a mano: generado desde el código con `bun run docs:errors`. -->

## 3. Catálogo de códigos por capa

### 3.1 Base de datos / Repositorio (R)

Acceso a datos: registro inexistente, ya eliminado, y violaciones de constraints de PostgreSQL (`RDB-E<SQLSTATE>`, las mapea el filtro por `driverError.code`).

| Código | HTTP | Clave en el catálogo | Mensaje (es) | Mensaje (en) |
|---|---|---|---|---|
| `RDB-E22001` | 400 | `ERROR_CODES.DB['22001']` | El valor supera la longitud máxima permitida para ese campo | The value exceeds the maximum length allowed for this field |
| `RDB-E23502` | 400 | `ERROR_CODES.DB['23502']` | Faltan campos obligatorios | Missing required fields restricted by the database |
| `RDB-E23503` | 409 | `ERROR_CODES.DB['23503']` | El campo no contiene una referencia válida | Foreign key violation |
| `RDB-E23505` | 409 | `ERROR_CODES.DB['23505']` | Ya existe un registro con esos datos únicos | A record with those unique values already exists |
| `RDB-E23514` | 422 | `ERROR_CODES.DB['23514']` | Los datos no cumplen las restricciones de la base de datos | Data does not satisfy database check constraints |
| `RSES-E001` | 404 | `ERROR_CODES.SES.NOT_FOUND` | Sesión no encontrada | Session not found |
| `RREL-E001` | 404 | `ERROR_CODES.REL.NOT_FOUND` | Relación no encontrada | Relationship not found |
| `RRPM-E001` | 404 | `ERROR_CODES.RPM.NOT_FOUND` | Permiso de rol no encontrado | Role permission not found |
| `RRPM-E002` | 409 | `ERROR_CODES.RPM.DUPLICATED` | Ese rol ya tiene ese permiso | That role already has that permission |
| `RNTF-E001` | 404 | `ERROR_CODES.NTF.NOT_FOUND` | Notificación no encontrada | Notification not found |
| `RTCK-E001` | 404 | `ERROR_CODES.TCK.NOT_FOUND` | Ticket no encontrado | Ticket not found |
| `RTCK-E002` | 410 | `ERROR_CODES.TCK.ALREADY_DELETED` | El ticket ya fue eliminado | Ticket already deleted |
| `RTCK-E003` | 409 | `ERROR_CODES.TCK.NOT_DELETED` | El ticket no está eliminado | Ticket is not deleted |

### 3.2 Servicio (S)

Reglas de negocio y autorización por registro (`BaseService.assertCan`) o por tipo (`CaslGuard`).

| Código | HTTP | Clave en el catálogo | Mensaje (es) | Mensaje (en) |
|---|---|---|---|---|
| `SAUT-E001` | 403 | `ERROR_CODES.AUT.FORBIDDEN` | No tienes permisos suficientes para esto | You don't have enough permissions for this |
| `SAUT-E002` | 401 | `ERROR_CODES.AUT.UNAUTHENTICATED` | Necesitas iniciar sesión | You need to sign in |
| `SAUT-E003` | 403 | `ERROR_CODES.AUT.CSRF_MISMATCH` | Token CSRF inválido o ausente | Invalid or missing CSRF token |
| `SAUT-E004` | 401 | `ERROR_CODES.AUT.INVALID_CREDENTIALS` | Credenciales inválidas | Invalid credentials |
| `SAUT-E005` | 401 | `ERROR_CODES.AUT.SESSION_EXPIRED` | Tu sesión expiró, vuelve a iniciar sesión | Your session expired, sign in again |
| `SAUT-E006` | 422 | `ERROR_CODES.AUT.CURRENT_PASSWORD_INVALID` | La contraseña actual no es correcta | The current password is not correct |
| `SAUT-E007` | 422 | `ERROR_CODES.AUT.PASSWORD_UNCHANGED` | La nueva contraseña debe ser distinta de la actual | The new password must be different from the current one |
| `SSES-E001` | 422 | `ERROR_CODES.SES.IS_CURRENT` | Para cerrar la sesión actual usa «Cerrar sesión» | To end the current session use sign out |
| `SRTL-E001` | 429 | `ERROR_CODES.RATE.TOO_MANY_REQUESTS` | Demasiadas solicitudes, intenta de nuevo más tarde | Too many requests, try again later |
| `SCONC-E001` | 412 | `ERROR_CODES.CONC.VERSION_MISMATCH` | Otra persona modificó este recurso; recarga e intenta de nuevo | The resource was modified by someone else; reload and try again |
| `SREL-E001` | 422 | `ERROR_CODES.REL.SELF_RELATIONSHIP` | No puedes compartir tus datos contigo mismo | You cannot share your data with yourself |
| `SREL-E002` | 422 | `ERROR_CODES.REL.ALTERNANTE_NOT_FOUND` | La persona alternante no existe | The alternate user does not exist |
| `SREL-E003` | 409 | `ERROR_CODES.REL.ALREADY_ACTIVE` | Ya existe una relación activa con esa persona | There is already an active relationship with that user |
| `SREL-E004` | 403 | `ERROR_CODES.REL.NOT_TITULAR` | Solo el titular puede cambiar las reglas de la relación | Only the owner (titular) can change the relationship rules |

### 3.3 Controlador / DTO (C)

Request inválido. `CVAL-E001` agrupa TODOS los errores de validación Zod; el detalle por campo va en `issues` (ver §4).

| Código | HTTP | Clave en el catálogo | Mensaje (es) | Mensaje (en) |
|---|---|---|---|---|
| `CVAL-E001` | 400 | `ERROR_CODES.VAL.INVALID_PAYLOAD` | Datos inválidos | Invalid data |

### 3.4 Sistema

Errores no mapeados. `NEST-E<status>` lo genera el filtro para `HttpException` de Nest sin código de negocio.

| Código | HTTP | Clave en el catálogo | Mensaje (es) | Mensaje (en) |
|---|---|---|---|---|
| `SYS-E999` | 500 | `ERROR_CODES.SYS.INTERNAL` | Error interno del servidor | Internal server error |

## 4. Validación de DTOs (Zod)

### 4.1 Catálogo de mensajes (`validation-errors.ts`)

| Clave | Parámetros | Mensaje (es) | Mensaje (en) |
|---|---|---|---|
| `VALIDATION_ERRORS.GENERIC.REQUIRED_SELECTION` | `field` | Selecciona {field} | Select {field} |
| `VALIDATION_ERRORS.GENERIC.MIN_LENGTH` | `field`, `min` | {field} debe tener al menos {min} caracteres | {field} must have at least {min} characters |
| `VALIDATION_ERRORS.GENERIC.MAX_LENGTH` | `field`, `max` | {field} no debe superar {max} caracteres | {field} must not exceed {max} characters |
| `VALIDATION_ERRORS.GENERIC.IS_NUMBER` | — | Ingresa un número | Enter a number |
| `VALIDATION_ERRORS.GENERIC.IS_INTEGER` | — | Solo números enteros | Whole numbers only |
| `VALIDATION_ERRORS.GENERIC.MIN_VALUE` | `min` | El valor mínimo es {min} | The minimum value is {min} |
| `VALIDATION_ERRORS.GENERIC.MAX_VALUE` | `max` | El valor máximo es {max} | The maximum value is {max} |
| `VALIDATION_ERRORS.GENERIC.IS_EMAIL` | — | Ingresa un correo válido (ej. ana@empresa.com) | Enter a valid email (e.g. ana@company.com) |
| `VALIDATION_ERRORS.GENERIC.IS_UUID` | — | UUID inválido | Invalid UUID |
| `VALIDATION_ERRORS.GENERIC.IS_DATE` | — | Fecha inválida | Invalid date |
| `VALIDATION_ERRORS.PAGINATION.MIN_PAGE` | `min` | La página mínima es {min} | The minimum page is {min} |
| `VALIDATION_ERRORS.PAGINATION.MAX_TAKE` | `max` | Máximo {max} registros por página | At most {max} records per page |
| `VALIDATION_ERRORS.TICKET.OTHER_CATEGORY_DETAIL_REQUIRED` | — | Describe la categoría | Describe the category |
| `VALIDATION_ERRORS.PASSWORD.CURRENT_REQUIRED` | — | Ingresa tu contraseña actual | Enter your current password |
| `VALIDATION_ERRORS.PASSWORD.MISSING` | `missing` | Agrega: {missing} | Add: {missing} |
| `VALIDATION_ERRORS.RELATIONSHIP.GRANTS_REQUIRED` | — | Indica al menos un recurso a compartir | Specify at least one resource to share |
| `VALIDATION_ERRORS.RELATIONSHIP.CONSENT_REQUIRED` | — | Debes aceptar el consentimiento para compartir tus datos | You must accept the consent to share your data |
<!-- error-catalog:generated:end -->

### 4.2 Mapeo por DTO: campo → regla → mensaje

Mensaje resultante = entrada del catálogo con sus parámetros ya interpolados. `code` = código del issue de Zod que viaja en `errors[].code`.

#### `CreateTicketDto` (POST `/api/tickets`) y `UpdateTicketDto` (PATCH `/api/tickets/:uuid`)

Schema: `src/modules/tickets/schemas/ticket.schema.ts` (`TicketCreateSchema` / `TicketUpsertSchema`).

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `title` | `.min(3)` (tras `trim`) | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'El título', min: 3}` | El título debe tener al menos 3 caracteres |
| `title` | `.max(120)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'El título', max: 120}` | El título no debe superar 120 caracteres |
| `description` | `.max(2000)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'La descripción', max: 2000}` | La descripción no debe superar 2000 caracteres |
| `category` | `enum(TICKET_CATEGORY)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una categoría'}` | Selecciona una categoría |
| `otherCategoryDetail` | `.max(120)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'El detalle', max: 120}` | El detalle no debe superar 120 caracteres |
| `otherCategoryDetail` | refine: obligatorio si `category = 'other'` | `custom` | `TICKET.OTHER_CATEGORY_DETAIL_REQUIRED` | Describe la categoría |
| `priority` | `enum(TICKET_PRIORITY)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una prioridad'}` | Selecciona una prioridad |
| `status` | `enum(TICKET_STATUS)` (POST: default `todo`) | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un estado'}` | Selecciona un estado |
| `assigneeEmail` | `email()` o `''` (POST: default `''`) | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |
| `estimateHours` | `number()` | `invalid_type` | `GENERIC.IS_NUMBER` | Ingresa un número |
| `estimateHours` | `.int()` | `invalid_type` | `GENERIC.IS_INTEGER` | Solo números enteros |
| `estimateHours` | `.min(1)` / `.max(200)` | `too_small` / `too_big` | `GENERIC.MIN_VALUE` `{min: 1}` / `GENERIC.MAX_VALUE` `{max: 200}` | El valor mínimo es 1 / El valor máximo es 200 |
| `dueDate` | `Date` o `'YYYY-MM-DD'` (nullable) | `invalid_union` | `GENERIC.IS_DATE` | Fecha inválida |
| `notifyReporter` | `boolean()` (POST: default `false`) | `invalid_type` | — (mensaje por defecto de Zod) | — |

#### `TicketQueryDto` (GET `/api/tickets`) — extiende `BasePaginationDto`

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `page` | `coerce.number().int().min(1)`, default 1 | `too_small` | `PAGINATION.MIN_PAGE` `{min: 1}` | La página mínima es 1 |
| `take` | `coerce.number().int().min(1).max(100)`, default 10 | `too_big` | `PAGINATION.MAX_TAKE` `{max: 100}` | Máximo 100 registros por página |
| `search` | `string().trim().max(100)` | `too_big` | — | — |
| `sortOrder` | `enum(['ASC','DESC'])` | `invalid_value` | — | — |
| `status` / `priority` | enums del contrato (opcionales) | `invalid_value` | — | — |

#### `UuidParamDto` (`:uuid` en rutas)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `uuid` | `uuid()` | `invalid_format` | `GENERIC.IS_UUID` | UUID inválido |

#### `SignInDto` (POST `/api/auth/sign-in`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `email` | `email()` | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |
| `password` | `.min(8)` | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'La contraseña', min: 8}` | La contraseña debe tener al menos 8 caracteres |
| (claves extra) | `strictObject` | `unrecognized_keys` | — (mensaje de Zod) | — |

#### `CreateRolePermissionDto` / `UpdateRolePermissionDto` (`/api/role-permissions`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `role` | `enum(EUserRole)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un rol'}` | Selecciona un rol |
| `subject` | `enum(SUBJECTS)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un recurso'}` | Selecciona un recurso |
| `action` | `enum(EAbility)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una acción'}` | Selecciona una acción |
| `condition` | `enum(CONDITION_PRESETS)`, default `NONE` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una condición'}` | Selecciona una condición |

#### `CreateRelationshipDto` / `UpdateRelationshipGrantsDto` (`/api/relationships`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `alternanteEmail` | `email()` | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |
| `grants` | `array().min(1)` | `too_small` | `RELATIONSHIP.GRANTS_REQUIRED` | Indica al menos un recurso a compartir |
| `grants.0.objectType` | `enum(SHAREABLE_OBJECT_TYPES)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un recurso'}` | Selecciona un recurso |
| `consent` | `literal(true)` | `invalid_value` | `RELATIONSHIP.CONSENT_REQUIRED` | Debes aceptar el consentimiento para compartir tus datos |

#### `ChangePasswordDto` (PATCH `/api/auth/password`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `currentPassword` | `min(1)` | `too_small` | `PASSWORD.CURRENT_REQUIRED` | Ingresa tu contraseña actual |
| `newPassword` | `min(8)` | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'La contraseña', min: 8}` | La contraseña debe tener al menos 8 caracteres |
| `newPassword` | `max(128)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'La contraseña', max: 128}` | La contraseña no debe superar 128 caracteres |
| `newPassword` | complejidad (`superRefine`: mayúscula, minúscula, número, símbolo) | `custom` | `PASSWORD.MISSING` `{missing}` | Agrega: mayúscula, número, símbolo (!@#$%) |
| (claves extra) | `strictObject` | `unrecognized_keys` | — (mensaje de Zod) | — |

El mensaje de complejidad dice QUÉ falta (lista las clases que la contraseña no cumple), no «inválida».

#### `UpdateAvatarDto` (PATCH `/api/users/me/avatar`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `avatarIcon` | `enum(AVATAR_ICONS).nullable()` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un ícono'}` | Selecciona un ícono |
| `avatarColor` | `enum(AVATAR_COLORS).nullable()` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un color'}` | Selecciona un color |

## 5. Dónde se lanza cada código de negocio

| Código | Lanzado en | Cuándo |
|---|---|---|
| `RTCK-E001` | `BaseService.findOrFail` (vía `TicketsService`) | uuid inexistente **o no legible** para el usuario (mismo 404: no se revela que existe) |
| `RTCK-E002` | `BaseService.findOneByUuid` | GET de un ticket con borrado lógico |
| `RTCK-E003` | `BaseService.restoreByUuid` | Restaurar un ticket que no está eliminado |
| `SAUT-E001` | `CaslGuard` (tipo) · `BaseService.assertCan` (registro) | Sin permiso: p. ej. VIEWER crea; AGENT edita un ticket que ni es suyo, ni le asignaron, ni le concedieron |
| `SAUT-E002` | `SessionAuthGuard` · servicios de autoservicio | Request sin sesión válida (sin cookie `sid` o expirada por inactividad) |
| `SAUT-E003` | `CsrfGuard` | Mutación sin `X-XSRF-TOKEN` o distinto de la cookie `XSRF-TOKEN` |
| `SAUT-E004` | `AuthSessionService.signIn` | Correo inexistente o contraseña incorrecta (misma respuesta: no se enumeran usuarios) |
| `SAUT-E005` | `SessionAuthGuard` | Más de 7 días desde el login (tope absoluto) aunque haya actividad |
| `SRTL-E001` | `RateLimitGuard` (por IP) · servicios de autenticación (por cuenta) | Más intentos que el límite de la ventana. Lleva `context.retryAfterSeconds` y la cabecera `Retry-After` |
| `SAUT-E006` | `AccountSecurityService.changePassword` | La contraseña actual enviada no coincide (cuenta como intento fallido: 5 por 15 min) |
| `SAUT-E007` | `AccountSecurityService.changePassword` | La nueva contraseña es igual a la actual |
| `RSES-E001` | `SessionIndexService.revoke` | El id de sesión no existe o no es del usuario (mismo 404: no se revela que existe) |
| `SSES-E001` | `SessionIndexService.revoke` | Se intentó cerrar la sesión ACTUAL desde «Mis sesiones» (se usa «Cerrar sesión») |
| `SCONC-E001` | `BaseService.assertIfMatch` | PATCH/DELETE con `If-Match` distinto del ETag vigente |
| `RREL-E001` | `RelationshipsService` | Relación inexistente, ajena o ya revocada |
| `SREL-E001` | `RelationshipsService.create` | El titular intenta compartir consigo mismo |
| `SREL-E002` | `RelationshipsService.create` | El correo del alternante no existe |
| `SREL-E003` | `RelationshipsService.create` | Ya hay una relación ACTIVA con esa persona |
| `SREL-E004` | `RelationshipsService.updateGrants` / `revoke` | Quien intenta cambiar las reglas es el alternante, no el titular |
| `RRPM-E001` | `BaseService.findOrFail` (vía `RolePermissionsService`) | Permiso por rol inexistente |
| `RRPM-E002` | `RolePermissionsService.create` / `update` | Ese rol ya tiene la misma acción sobre el mismo recurso y condición |
| `RNTF-E001` | `NotificationsService.markRead` | Notificación inexistente o de otra persona |
| `CVAL-E001` | `ZodValidationPipe` / `toResponse()` | Body, query o params no cumplen el schema (detalle en `issues`) |
| `RDB-E*` | `CustomExceptionFilter` | Violación de constraint de PostgreSQL (activo al conectar el ORM) |
| `SYS-E999` | `CustomExceptionFilter` | Excepción no mapeada |

## 6. Consumo en el front (ticketkanban)

- `core/interceptors/error.interceptor.ts` lee el Problem Details: toast con `title` (+ `detail`) y `code`, y **re-lanza** el error. El caller decide la UI (p. ej. el modal queda abierto).
- `errors[].path` coincide con la `key` del campo del formulario dinámico. Los mensajes son los mismos que valida el formulario (catálogo espejo `core/validation/validation-errors.ts`).
- `401 SAUT-E002/E005` → la sesión se perdió: el front vuelve a iniciar sesión.
- El mock del BFF (`core/mock-bff/mock-bff.handler.ts`) devuelve el mismo Problem Details.

## 7. Cómo agregar un error nuevo (checklist)

1. **Negocio / BD:** agregar la entrada en `ERROR_CODES` bajo el módulo de 3 letras, con prefijo de capa correcto y los dos mensajes.
2. **Validación:** agregar la entrada en `VALIDATION_ERRORS` y usarla en el schema con `validationMessage(...)`. Nunca un texto suelto en el schema.
3. Correr `bun run docs:errors` para regenerar §3 y §4.1.
4. Agregar la fila a §4.2 (validación) o §5 (negocio) a mano.
5. Si el endpoint lo puede devolver, documentarlo en el controller con `@ApiProblemResponse(status, '<código> · <cuándo>')` (`application/problem+json`): aparece en Scalar (`/api/reference`).
6. Si el front lo consume, replicar el código y el mensaje en el mock del BFF.
