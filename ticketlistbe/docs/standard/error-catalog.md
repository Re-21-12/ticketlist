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
| `RMNU-E001` | 404 | `ERROR_CODES.MNU.NOT_FOUND` | Ítem de menú no encontrado | Menu item not found |
| `RMNU-E002` | 409 | `ERROR_CODES.MNU.DUPLICATED_KEY` | Ya existe un ítem de menú con esa clave | A menu item with that key already exists |
| `RMNU-E003` | 410 | `ERROR_CODES.MNU.ALREADY_DELETED` | El ítem de menú ya fue eliminado | Menu item already deleted |
| `RCAT-E001` | 404 | `ERROR_CODES.CAT.NOT_FOUND` | Catálogo no encontrado | Catalog not found |
| `RCAT-E002` | 404 | `ERROR_CODES.CAT.ITEM_NOT_FOUND` | Elemento del catálogo no encontrado | Catalog item not found |
| `RCAT-E003` | 409 | `ERROR_CODES.CAT.DUPLICATED_CODE` | Ese código ya existe en este catálogo | That code already exists in this catalog |
| `RCAT-E004` | 409 | `ERROR_CODES.CAT.SYSTEM_ITEM` | Los elementos del sistema no se eliminan ni cambian de código | System items cannot be deleted or have their code changed |
| `RCAT-E005` | 409 | `ERROR_CODES.CAT.DUPLICATED_KEY` | Ya existe un catálogo con esa clave | A catalog with that key already exists |
| `RRPM-E001` | 404 | `ERROR_CODES.RPM.NOT_FOUND` | Permiso de rol no encontrado | Role permission not found |
| `RRPM-E002` | 409 | `ERROR_CODES.RPM.DUPLICATED` | Ese rol ya tiene ese permiso | That role already has that permission |
| `RNTF-E001` | 404 | `ERROR_CODES.NTF.NOT_FOUND` | Notificación no encontrada | Notification not found |
| `RTCK-E001` | 404 | `ERROR_CODES.TCK.NOT_FOUND` | Ticket no encontrado | Ticket not found |
| `RTCK-E002` | 410 | `ERROR_CODES.TCK.ALREADY_DELETED` | El ticket ya fue eliminado | Ticket already deleted |
| `RTCK-E003` | 409 | `ERROR_CODES.TCK.NOT_DELETED` | El ticket no está eliminado | Ticket is not deleted |
| `RATT-E001` | 404 | `ERROR_CODES.ATT.NOT_FOUND` | Adjunto no encontrado | Attachment not found |
| `RJOB-E001` | 404 | `ERROR_CODES.JOB.NOT_FOUND` | Tarea programada no encontrada | Scheduled job not found |

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
| `SAUT-E008` | 403 | `ERROR_CODES.AUT.EMAIL_NOT_VERIFIED` | Verifica tu correo antes de iniciar sesión | Verify your email before signing in |
| `SAUT-E009` | 400 | `ERROR_CODES.AUT.TOKEN_INVALID` | El enlace no es válido o ya venció | The link is invalid or has expired |
| `SAUT-E010` | 401 | `ERROR_CODES.AUT.RECOVERY_INVALID` | Los datos de verificación no son correctos | The verification data is not correct |
| `SAUT-E011` | 422 | `ERROR_CODES.AUT.TOTP_CODE_INVALID` | El código del autenticador no es correcto | The authenticator code is not correct |
| `SAUT-E012` | 409 | `ERROR_CODES.AUT.TOTP_NOT_PENDING` | No hay una configuración del autenticador en curso | There is no authenticator setup in progress |
| `SAUT-E014` | 423 | `ERROR_CODES.AUT.ACCOUNT_LOCKED` | Tu cuenta está bloqueada por demasiados intentos fallidos. Comunícate con un administrador para desbloquearla | Your account is locked after too many failed attempts. Contact an administrator to unlock it |
| `SAUT-E013` | 409 | `ERROR_CODES.AUT.TOTP_ALREADY_ENABLED` | El autenticador ya está activado | The authenticator is already enabled |
| `SUSR-E001` | 409 | `ERROR_CODES.USR.EMAIL_TAKEN` | Ya existe una cuenta con ese correo | An account with that email already exists |
| `SUSR-E002` | 404 | `ERROR_CODES.USR.NOT_FOUND` | Usuario no encontrado | User not found |
| `SUSR-E003` | 409 | `ERROR_CODES.USR.CANNOT_CHANGE_SELF` | No puedes cambiar tu propio rol ni deshabilitar tu propia cuenta | You cannot change your own role or disable your own account |
| `SUSR-E004` | 409 | `ERROR_CODES.USR.LAST_ADMIN` | Debe quedar al menos un administrador activo | At least one active administrator must remain |
| `SSES-E001` | 422 | `ERROR_CODES.SES.IS_CURRENT` | Para cerrar la sesión actual usa «Cerrar sesión» | To end the current session use sign out |
| `SRTL-E001` | 429 | `ERROR_CODES.RATE.TOO_MANY_REQUESTS` | Demasiadas solicitudes, intenta de nuevo más tarde | Too many requests, try again later |
| `SCONC-E001` | 412 | `ERROR_CODES.CONC.VERSION_MISMATCH` | Otra persona modificó este recurso; recarga e intenta de nuevo | The resource was modified by someone else; reload and try again |
| `SREL-E001` | 422 | `ERROR_CODES.REL.SELF_RELATIONSHIP` | No puedes compartir tus datos contigo mismo | You cannot share your data with yourself |
| `SREL-E002` | 422 | `ERROR_CODES.REL.ALTERNANTE_NOT_FOUND` | La persona alternante no existe | The alternate user does not exist |
| `SREL-E003` | 409 | `ERROR_CODES.REL.ALREADY_ACTIVE` | Ya existe una relación activa con esa persona | There is already an active relationship with that user |
| `SREL-E004` | 403 | `ERROR_CODES.REL.NOT_TITULAR` | Solo el titular puede cambiar las reglas de la relación | Only the owner (titular) can change the relationship rules |
| `SAUD-E001` | 404 | `ERROR_CODES.AUD.NOT_FOUND` | Entrada de auditoría no encontrada | Audit entry not found |
| `STCK-E001` | 409 | `ERROR_CODES.TCK.TRANSITION_NOT_ALLOWED` | El ticket no puede pasar a ese estado | The ticket cannot move to that status |
| `STCK-E002` | 409 | `ERROR_CODES.TCK.COMMENTS_IMMUTABLE` | Los comentarios previos no pueden modificarse | Previous comments cannot be modified |
| `STCK-E003` | 409 | `ERROR_CODES.TCK.CLOSED_NO_COMMENTS` | El ticket está cerrado: reábrelo para comentar | The ticket is closed: reopen it to comment |
| `STCK-E004` | 409 | `ERROR_CODES.TCK.REOPEN_WINDOW_EXPIRED` | Venció el plazo para reabrir el ticket; registra uno nuevo | The reopening window has expired; open a new ticket |
| `STCK-E005` | 403 | `ERROR_CODES.TCK.ASSIGNMENT_FORBIDDEN` | Solo puedes tomar tickets que no tengan responsable | You can only take tickets that have no assignee |
| `STCK-E007` | 422 | `ERROR_CODES.TCK.DEPARTMENT_INVALID` | Ese departamento no existe o no está disponible | That department does not exist or is not available |
| `STCK-E006` | 422 | `ERROR_CODES.TCK.ASSIGNEE_NOT_FOUND` | Esa persona no puede recibir tickets | That person cannot be assigned tickets |
| `SATT-E001` | 413 | `ERROR_CODES.ATT.TOO_LARGE` | El archivo supera el tamaño permitido | The file is too large |
| `SATT-E002` | 415 | `ERROR_CODES.ATT.TYPE_NOT_ALLOWED` | Ese tipo de archivo no está permitido | That file type is not allowed |
| `SATT-E003` | 400 | `ERROR_CODES.ATT.FILE_REQUIRED` | Adjunta un archivo | Attach a file |
| `SATT-E004` | 422 | `ERROR_CODES.ATT.VIDEO_TOO_LONG` | El video dura más de 5 minutos | The video is longer than 5 minutes |
| `SATT-E005` | 422 | `ERROR_CODES.ATT.VIDEO_DURATION_UNKNOWN` | No se pudo comprobar la duración del video | The video duration could not be verified |
| `SATT-E006` | 503 | `ERROR_CODES.ATT.STORAGE_UNAVAILABLE` | El almacenamiento de archivos no está disponible en este momento | File storage is not available right now |
| `SSRV-E001` | 404 | `ERROR_CODES.SRV.NOT_AVAILABLE` | No hay encuesta disponible para este ticket | There is no survey available for this ticket |
| `SSRV-E002` | 409 | `ERROR_CODES.SRV.ALREADY_ANSWERED` | La encuesta ya fue respondida | The survey was already answered |
| `SSRV-E003` | 410 | `ERROR_CODES.SRV.EXPIRED` | La encuesta venció | The survey expired |

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
| `VALIDATION_ERRORS.TICKET.RESOLUTION_REQUIRED` | — | Documenta la solución para poder resolver el ticket | Document the solution to resolve the ticket |
| `VALIDATION_ERRORS.TICKET.SURVEY_SCORE` | — | Elige una calificación de 1 a 5 | Choose a rating from 1 to 5 |
| `VALIDATION_ERRORS.PASSWORD.CURRENT_REQUIRED` | — | Ingresa tu contraseña actual | Enter your current password |
| `VALIDATION_ERRORS.PASSWORD.MISSING` | `missing` | Agrega: {missing} | Add: {missing} |
| `VALIDATION_ERRORS.ACCOUNT.TOKEN_REQUIRED` | — | El enlace no es válido | The link is not valid |
| `VALIDATION_ERRORS.ACCOUNT.CODE_INVALID` | — | Escribe el código de 6 dígitos de tu autenticador | Enter the 6-digit code from your authenticator |
| `VALIDATION_ERRORS.RELATIONSHIP.GRANTS_REQUIRED` | — | Indica al menos un recurso a compartir | Specify at least one resource to share |
| `VALIDATION_ERRORS.RELATIONSHIP.CONSENT_REQUIRED` | — | Debes aceptar el consentimiento para compartir tus datos | You must accept the consent to share your data |
| `VALIDATION_ERRORS.ADMIN.INVALID_KEY` | — | Usa solo minúsculas, números y guiones (empieza con una letra) | Use only lowercase letters, numbers and hyphens (start with a letter) |
| `VALIDATION_ERRORS.ADMIN.INVALID_ROUTE` | — | Escribe una ruta interna que empiece con una sola barra, por ejemplo /tickets | Enter an internal path that starts with a single slash, for example /tickets |
| `VALIDATION_ERRORS.ADMIN.INVALID_ICON` | — | El ícono debe tener la forma pi-nombre | The icon must look like pi-name |
| `VALIDATION_ERRORS.ADMIN.INVALID_CODE` | — | Usa solo mayúsculas, números y guion bajo (empieza con una letra) | Use only uppercase letters, numbers and underscores (start with a letter) |
| `VALIDATION_ERRORS.METRICS.PERIOD_ORDER` | — | La fecha final no puede ser anterior a la inicial | The end date cannot be before the start date |
| `VALIDATION_ERRORS.METRICS.PERIOD_TOO_LONG` | `max` | El período no puede superar {max} días | The period cannot exceed {max} days |
| `VALIDATION_ERRORS.JOB.CRON_INVALID` | — | La expresión cron no es válida: usa 5 campos (minuto hora día mes día-de-la-semana), por ejemplo */10 * * * * | The cron expression is not valid: use 5 fields (minute hour day month weekday), for example */10 * * * * |
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
| `type` | `enum(TICKET_TYPE)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un tipo'}` | Selecciona un tipo |
| `category` | `enum(TICKET_CATEGORY)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una categoría'}` | Selecciona una categoría |
| `complexity` | `enum(TICKET_COMPLEXITY)` (opcional, solo el equipo) | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una complejidad'}` | Selecciona una complejidad |
| `otherCategoryDetail` | `.max(120)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'El detalle', max: 120}` | El detalle no debe superar 120 caracteres |
| `otherCategoryDetail` | refine: obligatorio si `category = 'other'` | `custom` | `TICKET.OTHER_CATEGORY_DETAIL_REQUIRED` | Describe la categoría |
| `priority` | `enum(TICKET_PRIORITY)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'una prioridad'}` | Selecciona una prioridad |
| `assigneeEmail` | `email()` o `''` (POST: default `''`) | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |
| `estimateHours` | `number()` | `invalid_type` | `GENERIC.IS_NUMBER` | Ingresa un número |
| `estimateHours` | `.int()` | `invalid_type` | `GENERIC.IS_INTEGER` | Solo números enteros |
| `estimateHours` | `.min(1)` / `.max(200)` | `too_small` / `too_big` | `GENERIC.MIN_VALUE` `{min: 1}` / `GENERIC.MAX_VALUE` `{max: 200}` | El valor mínimo es 1 / El valor máximo es 200 |
| `dueDate` | `Date` o `'YYYY-MM-DD'` (nullable) | `invalid_union` | `GENERIC.IS_DATE` | Fecha inválida |
| `notifyReporter` | `boolean()` (POST: default `false`) | `invalid_type` | — (mensaje por defecto de Zod) | — |

> `status` ya NO se envía al crear ni al editar: el estado solo cambia por una transición (`POST /api/tickets/:uuid/transitions`).

#### Seguimiento del ticket (`/api/tickets/:uuid/comments`, `/transitions`, `/assign`, `/survey`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `body` | `.min(1)` (tras `trim`) | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'El comentario', min: 1}` | El comentario debe tener al menos 1 caracteres |
| `body` | `.max(2000)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'El comentario', max: 2000}` | El comentario no debe superar 2000 caracteres |
| `to` | `enum(TICKET_STATUS)` | `invalid_value` | `GENERIC.REQUIRED_SELECTION` `{field: 'un estado'}` | Selecciona un estado |
| `resolution` | refine: obligatoria (≥ 3 caracteres) si `to = 'resolved'` | `custom` | `TICKET.RESOLUTION_REQUIRED` | Documenta la solución para poder resolver el ticket |
| `resolved` | `boolean()` (obligatorio) | `invalid_type` | `GENERIC.REQUIRED_SELECTION` `{field: 'si se resolvió el problema'}` | Selecciona si se resolvió el problema |
| `score` | `number().int().min(1).max(5)` (tipo) | `invalid_type` | `TICKET.SURVEY_SCORE` | Elige una calificación de 1 a 5 |
| `score` | `number().int().min(1).max(5)` (límite) | `too_big` | `TICKET.SURVEY_SCORE` | Elige una calificación de 1 a 5 |
| `assigneeEmail` | `email()` | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |

#### Tareas programadas (`PATCH /api/jobs/:key`)

Schema: `src/modules/jobs/jobs.schema.ts` (`JobUpdateSchema`).

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `cron` | refine: 5 campos válidos (`parseCron`) | `custom` | `JOB.CRON_INVALID` | La expresión cron no es válida: usa 5 campos (minuto hora día mes día-de-la-semana), por ejemplo */10 * * * * |
| `params.afterHours` | `number().int().min(1).max(720)` (límite) | `too_small` | `GENERIC.MIN_VALUE` `{min: 1}` | El valor mínimo es 1 |

#### Métricas (`/api/metrics/*`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `to` | refine: no anterior a `from` | `custom` | `METRICS.PERIOD_ORDER` | La fecha final no puede ser anterior a la inicial |
| `to` | refine: período ≤ 366 días | `custom` | `METRICS.PERIOD_TOO_LONG` `{max: 366}` | El período no puede superar 366 días |

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

#### `SignUpDto` (POST `/api/auth/sign-up`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `name` | `trim().min(3)` | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'El nombre', min: 3}` | El nombre debe tener al menos 3 caracteres |
| `name` | `max(120)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'El nombre', max: 120}` | El nombre no debe superar 120 caracteres |
| `email` | `email()` | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |
| `password` | `min(8)` | `too_small` | `GENERIC.MIN_LENGTH` `{field: 'La contraseña', min: 8}` | La contraseña debe tener al menos 8 caracteres |
| `password` | `max(128)` | `too_big` | `GENERIC.MAX_LENGTH` `{field: 'La contraseña', max: 128}` | La contraseña no debe superar 128 caracteres |
| `password` | complejidad (`superRefine`) | `custom` | `PASSWORD.MISSING` `{missing}` | Agrega: mayúscula, número, símbolo (!@#$%) |
| (claves extra, p. ej. `role`) | `strictObject` | `unrecognized_keys` | — (mensaje de Zod) | — |

El registro público **no admite `role`**: `strictObject` rechaza cualquier clave extra (asignación masiva) y la cuenta nace siempre como `VIEWER`.

#### `EmailOnlyDto` (POST `/api/auth/forgot-password` y `/api/auth/resend-verification`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `email` | `email()` | `invalid_format` | `GENERIC.IS_EMAIL` | Ingresa un correo válido (ej. ana@empresa.com) |

#### `VerifyEmailDto` (POST `/api/auth/verify-email`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `token` | `regex(/^[A-Za-z0-9_-]{20,128}$/)` | `invalid_format` | `ACCOUNT.TOKEN_REQUIRED` | El enlace no es válido |

#### `ResetPasswordDto` (POST `/api/auth/reset-password`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `token` | `regex(…)` (igual que arriba) | `invalid_format` | `ACCOUNT.TOKEN_REQUIRED` | El enlace no es válido |
| `newPassword` | `min(8)` · `max(128)` · complejidad | `too_small` · `too_big` · `custom` | las mismas tres claves de `SignUpDto.password` | (ver `SignUpDto`) |

La validación del DTO corre ANTES del servicio: una contraseña débil devuelve 400 **sin consumir** el token, y se puede corregir y reintentar con el mismo enlace.

#### `RecoverPasswordDto` (POST `/api/auth/recover-password`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `code` | `regex(/^\d{6}$/)` (solo `method = totp`) | `invalid_format` | `ACCOUNT.CODE_INVALID` | Escribe el código de 6 dígitos de tu autenticador |
| `currentPassword` | `min(1)` (solo `method = current_password`) | `too_small` | `PASSWORD.CURRENT_REQUIRED` | Ingresa tu contraseña actual |
| `newPassword` | `min(8)` · `max(128)` · complejidad | `too_small` · `too_big` · `custom` | las mismas tres claves de `SignUpDto.password` | (ver `SignUpDto`) |

#### `TotpEnableDto` (POST `/api/auth/totp/enable`)

| Campo | Regla (Zod) | `code` | Clave del catálogo | Mensaje resultante |
|---|---|---|---|---|
| `code` | `regex(/^\d{6}$/)` | `invalid_format` | `ACCOUNT.CODE_INVALID` | Escribe el código de 6 dígitos de tu autenticador |

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
| `SAUT-E008` | `AuthSessionService.signIn` | La contraseña es correcta pero el correo no se verificó (solo se dice DESPUÉS de acertar la contraseña: quien no la sabe no aprende nada) |
| `STCK-E007` | `TicketsService.toEntity` · `mergeEntity` | El `department` no es un elemento ACTIVO del catálogo `ticket-department` (se revalida solo si cambia) |
| `SAUT-E009` | `AccountRecoveryService.verifyEmail` · `resetPassword` | El token no existe, ya se usó o venció (24 h verificación, 45 min restablecer) |
| `SAUT-E010` | `AccountRecoveryService.recoverPassword` | Código TOTP o contraseña actual incorrectos, cuenta inexistente o sin autenticador: MISMA respuesta en todos (anti-enumeración) |
| `SAUT-E014` | `AuthSessionService.signIn` | Cuenta bloqueada tras `LOGIN_MAX_ATTEMPTS` (5) intentos fallidos seguidos: 423 con `context.contacts` (nombre y correo de los administradores). Solo un administrador la desbloquea |
| `SAUT-E011` | `AccountSecurityService.enableTotp` | El código con que se confirma el alta del autenticador no coincide |
| `SAUT-E012` | `AccountSecurityService.enableTotp` | Se confirma sin haber pedido antes `totp/setup` |
| `SAUT-E013` | `AccountSecurityService.setupTotp` | El autenticador ya está activado |
| `SUSR-E001` | `AccountRecoveryService.signUp` | Ya existe una cuenta con ese correo (se normaliza a minúsculas) |
| `SUSR-E002` | `UsersAdminController` (`findOne`, `changeRole`, `changeStatus`) | El `uuid` no corresponde a ningún usuario |
| `SUSR-E003` | `UsersAdminController.assertNotSelf` | Intento de cambiarse el propio rol o deshabilitar la propia cuenta |
| `STCK-E001` | `TicketLifecycleService.transition` · `assign` | La transición no está permitida desde el estado actual para ese papel (p. ej. el equipo no cierra por el solicitante, nada vuelve a «Nuevo») |
| `STCK-E002` | `TicketLifecycleController` (PATCH/PUT/DELETE de un comentario) | Intento de modificar o borrar un comentario previo: el historial es inmutable |
| `STCK-E003` | `TicketLifecycleService.comment` | Comentar un ticket «Cerrado»: hay que reabrirlo |
| `STCK-E004` | `TicketLifecycleService.transition` | Reabrir un cerrado fuera de los 7 días de reincidencia |
| `STCK-E005` | `TicketLifecycleService.assign` | Un agente intenta asignar a otra persona o tomar un ticket que ya tiene responsable |
| `STCK-E006` | `TicketLifecycleService.assign` | La persona indicada no puede recibir tickets (cliente, deshabilitada, inexistente) |
| `SATT-E001` | `TicketLifecycleController.upload` · filtro de excepciones (multer) | El archivo supera el tope de su tipo (imagen 10 MB, documento 25 MB, video 100 MB) |
| `SATT-E002` | `TicketLifecycleController.upload` | El contenido no es un tipo permitido (imagen, PDF, Excel, CSV, texto o video mp4/mov/webm): se detecta por firma, no por el nombre |
| `SATT-E003` | `TicketLifecycleController.upload` | Falta el archivo |
| `SATT-E004` | `TicketLifecycleController.upload` | Un video dura más de 5 minutos (la duración se lee de la cabecera del archivo) |
| `SATT-E005` | `TicketLifecycleController.upload` | La duración del video no se puede comprobar (cabecera ilegible o fragmentada sin duración): no se acepta lo que no se puede verificar |
| `SATT-E006` | `TicketLifecycleController` (`upload`, `download`) | El bucket de archivos (MinIO/S3) no responde |
| `RJOB-E001` | `JobsService` (`update`, `run`) | La tarea programada no existe |
| `RATT-E001` | `TicketLifecycleController.download` · `TicketLifecycleService.comment` | Adjunto inexistente, de otro ticket o ya usado en otro comentario |
| `SSRV-E001` | `TicketLifecycleService.loadSurvey` | No hay encuesta: el ticket no está cerrado o quien consulta no es el solicitante |
| `SSRV-E002` | `TicketLifecycleService.answerSurvey` | La encuesta ya fue respondida |
| `SSRV-E003` | `TicketLifecycleService.answerSurvey` | La encuesta venció (7 días) |
| `SUSR-E004` | `UsersAdminController.assertNotLastAdmin` | Quitar el rol o deshabilitar al único administrador activo |
| `RMNU-E001` | `BaseService.findOrFail` (vía `MenuItemsService`) | `uuid` de ítem de menú inexistente |
| `RMNU-E002` | `MenuItemsService.create` · `update` | La `key` ya la usa otro ítem vigente |
| `RMNU-E003` | `BaseService.findOneByUuid` | GET de un ítem de menú con borrado lógico (410) |
| `RCAT-E001` | `CatalogsService.mustFind` | La clave del catálogo no existe |
| `RCAT-E002` | `CatalogsService.mustFindItem` | El `uuid` del elemento no existe en ese catálogo |
| `RCAT-E003` | `CatalogsService.createItem` · `updateItem` | El código ya existe en el catálogo (sin distinguir mayúsculas) |
| `RCAT-E004` | `CatalogsService.updateItem` · `removeItem` · `remove` | Cambiar el código o desactivar un elemento de sistema, o eliminar un elemento/catálogo de sistema |
| `RCAT-E005` | `CatalogsService.create` | Ya existe un catálogo con esa clave |
| `SAUD-E001` | `AuditLogController.findOne` | La entrada de auditoría no existe |
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
