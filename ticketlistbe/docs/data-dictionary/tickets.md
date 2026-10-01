# tickets — Diccionario de datos

> Basado en `src/modules/tickets/ticket.entity.ts` y `src/modules/tickets/schemas/ticket.schema.ts`
> (espejo en el front: `ticketkanban/src/app/pages/tickets/ticket.schema.ts`).

## Descripción

Ticket de trabajo del tablero kanban. Lo crea cualquier rol con `create` sobre `Ticket`; el
borrado es **lógico** (`is_deleted`, restaurable con `PATCH /:uuid/restore`). El `code`
(`TCK-###`) lo asigna el backend y no se edita.

## Campos

| Columna (BD) | Campo (entity/DTO) | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `code` | `code` | `varchar(12)` | NO | `TCK-<n>` | UNIQUE, solo backend | Código visible |
| `title` | `title` | `varchar(120)` | NO | — | 3–120 caracteres (tras `trim`) | Resumen del ticket |
| `description` | `description` | `varchar(2000)` | NO | `''` | ≤ 2000 caracteres | Detalle libre |
| `category` | `category` | `enum` | NO | — | `bug` \| `feature` \| `support` \| `other` | Tipo de ticket |
| `other_category_detail` | `otherCategoryDetail` | `varchar(120)` | SÍ | NULL | Obligatorio si `category = 'other'`; se guarda NULL en otro caso | «Otra: especifique» |
| `priority` | `priority` | `enum` | NO | — | `low` \| `medium` \| `high` \| `critical` | Prioridad |
| `status` | `status` | `enum` | NO | `todo` | `todo` \| `in_progress` \| `done` | Columna del tablero |
| `assignee_email` | `assigneeEmail` | `varchar(254)` | NO | `''` | email válido o vacío | Responsable (vacío = sin asignar) |
| `estimate_hours` | `estimateHours` | `smallint` | SÍ | NULL | entero 1–200 | Estimación |
| `due_date` | `dueDate` | `date` | SÍ | NULL | `'YYYY-MM-DD'` | Fecha límite (sin hora) |
| `notify_reporter` | `notifyReporter` | `boolean` | NO | `false` | — | Avisar al solicitante |
| `owner_uuid` | `ownerUuid` | `uuid` | NO | `created_by` | FK `users.uuid`, solo backend | **Titular** del ticket (quien lo creó). Base de las reglas de titular y de ReBAC |

> Auditoría heredada de `BaseEntity`: no se repite.

## Validaciones (DTO Zod)

| Campo | Create (`TicketCreateSchema`) | Update (`TicketUpsertSchema`) | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|---|
| `title` | obligatorio | obligatorio | `trim().min(3).max(120)` | `GENERIC.MIN_LENGTH`, `GENERIC.MAX_LENGTH` |
| `description` | obligatorio (`''` válido) | obligatorio | `trim().max(2000)` | `GENERIC.MAX_LENGTH` |
| `category` | obligatorio | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `otherCategoryDetail` | condicional | condicional | `max(120)` + refine si `other` | `GENERIC.MAX_LENGTH`, `TICKET.OTHER_CATEGORY_DETAIL_REQUIRED` |
| `priority` | obligatorio | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `status` | opcional (default `todo`) | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `assigneeEmail` | opcional (default `''`) | obligatorio | email o `''` | `GENERIC.IS_EMAIL` |
| `estimateHours` | opcional (default `null`) | obligatorio (nullable) | `int().min(1).max(200)` | `GENERIC.IS_NUMBER`, `IS_INTEGER`, `MIN_VALUE`, `MAX_VALUE` |
| `dueDate` | opcional (default `null`) | obligatorio (nullable) | `Date` o `'YYYY-MM-DD'` | `GENERIC.IS_DATE` |
| `notifyReporter` | opcional (default `false`) | obligatorio | boolean | — |

> Mensaje resultante y `code` de cada regla: [error-catalog.md §4.2](../standard/error-catalog.md).

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `CVAL-E001` | 400 | POST `/`, PATCH `/:uuid`, GET `/` (query), rutas `/:uuid` | Body, query o params inválidos (`issues` por campo) |
| `SAUT-E002` | 401 | todos | Sin sesión |
| `SAUT-E003` | 403 | POST/PATCH/DELETE | Falta `X-XSRF-TOKEN` o no coincide |
| `SAUT-E001` | 403 | todos | Sin permiso por tipo (guard) o por registro (servicio) |
| `RTCK-E001` | 404 | GET/PATCH/DELETE `/:uuid`, PATCH `/:uuid/restore` | No existe o **no es legible** para el usuario |
| `SCONC-E001` | 412 | PATCH/DELETE `/:uuid` | `If-Match` distinto del ETag vigente |
| `RTCK-E002` | 410 | GET `/:uuid` | Ticket con borrado lógico |
| `RTCK-E003` | 409 | PATCH `/:uuid/restore` | El ticket no está eliminado |
| `RDB-E23505` | 409 | POST `/` | `code` duplicado (al conectar el ORM, UNIQUE) |

## Índices

| Nombre | Columnas | Tipo | Justificación |
|---|---|---|---|
| `UQ_tickets_uuid` | `uuid` | UNIQUE | Identificador público |
| `UQ_tickets_code` | `code` | UNIQUE | Código visible único |
| `IDX_tickets_status` | `status` | plain | Tablero agrupa por estado |
| `IDX_tickets_assignee_email` | `assignee_email` | plain | Regla CASL «asignado a mí» |
| `IDX_tickets_owner_uuid` | `owner_uuid` | plain | Reglas de titular y ReBAC (`owner_uuid IN (...)`) |

## Relaciones

| Campo | Tipo | Entidad destino | ON DELETE | Descripción |
|---|---|---|---|---|
| `owner_uuid` | N:1 | `users` | RESTRICT | Titular |

`assignee_email` sigue siendo texto: la regla `ASSIGNED_TO_ME` compara por correo.

## Enums / constantes de dominio

| Constante | Valores | Ubicación |
|---|---|---|
| `TICKET_STATUS` | `todo`, `in_progress`, `done` | `schemas/ticket.schema.ts` |
| `TICKET_PRIORITY` | `low`, `medium`, `high`, `critical` | `schemas/ticket.schema.ts` |
| `TICKET_CATEGORY` | `bug`, `feature`, `support`, `other` | `schemas/ticket.schema.ts` |

## Permisos (CASL)

Reglas completas y precedencia: [authorization.md](../standard/authorization.md). Seed de `role_permissions`:

| Rol | Acciones | Condiciones |
|---|---|---|
| `ADMIN` | `manage` | — |
| `AGENT` | `read`, `create`, `update` | `update` solo si `assigneeEmail` = su correo (`ASSIGNED_TO_ME`) |
| `VIEWER` | `read` | — |
| Titular (cualquier rol) | `read`, `update`, `delete`, `restore` | `ownerUuid` = yo |
| Alternante | lo concedido (`canRead`/`canUpdate`/`canDelete`) | `ownerUuid ∈ titulares`, recortado por el techo del rol |

## Reglas de negocio derivadas

- `otherCategoryDetail` solo se persiste si `category = 'other'`; en otro caso se guarda NULL.
- `code` es secuencial y lo asigna `TicketsRepository.nextCode()`; el cliente nunca lo envía.
- Un ticket eliminado no aparece en `findAll` salvo `includeDeleted=true`.
- `ownerUuid` = `createdBy` al crear; el cliente nunca lo envía.
- Al asignar (alta o cambio de `assigneeEmail`) se notifica al asignado (`TICKET_ASSIGNED`). Si edita un alternante con `notifyTitular`, se notifica al titular (`TICKET_CHANGED_BY_ALTERNANTE`).
