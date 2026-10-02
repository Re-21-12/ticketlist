# tickets — Diccionario de datos

> Basado en `src/modules/tickets/ticket.entity.ts` y `src/modules/tickets/schemas/ticket.schema.ts`
> (espejo en el front: `ticketkanban/src/app/pages/tickets/ticket.schema.ts`).

## Descripción

Solicitud de servicio (Service Desk N1). Lo registra una persona con `create` sobre `Ticket` (el CLIENTE, rol `VIEWER`, también) y esa persona es su **solicitante/titular**: ve y sigue SOLO los suyos. Recorre un ciclo de vida (§Ciclo de vida) con historial inmutable; el
borrado es **lógico** (`is_deleted`, restaurable con `PATCH /:uuid/restore`). El `code`
(`TCK-###`) lo asigna el backend y no se edita.

## Campos

| Columna (BD) | Campo (entity/DTO) | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `code` | `code` | `varchar(12)` | NO | `TCK-<n>` | UNIQUE, solo backend | Código visible |
| `title` | `title` | `varchar(120)` | NO | — | 3–120 caracteres (tras `trim`) | Resumen del ticket |
| `description` | `description` | `varchar(2000)` | NO | `''` | ≤ 2000 caracteres | Detalle libre |
| `type` | `type` | `enum` | NO | — | `incident` \| `service_request` \| `inquiry` \| `improvement` | Tipo de incidencia o solicitud (CU05, paso 3). Una `improvement` tiene plazo de 48 h |
| `department` | `department` | `varchar(40)` | NO | `'it'` | Código ACTIVO del catálogo `ticket-department` (se valida en el servicio, `STCK-E007`; se revalida solo si cambia) | De qué departamento viene la solicitud; `it` = «TI (interno)», nace dentro del propio equipo de TI |
| `category` | `category` | `enum` | NO | — | `hardware` \| `software` \| `network` \| `access` \| `email` \| `other` | Categoría funcional (CU05, paso 4) |
| `complexity` | `complexity` | `enum` | SÍ | NULL | `simple` \| `moderate` \| `complex` | Esfuerzo estimado. **Solo el equipo la fija**; el cliente no la edita (se ignora si la envía) |
| `other_category_detail` | `otherCategoryDetail` | `varchar(120)` | SÍ | NULL | Obligatorio si `category = 'other'`; se guarda NULL en otro caso | «Otra: especifique» |
| `priority` | `priority` | `enum` | NO | — | `low` \| `medium` \| `high` \| `critical` | Urgencia (el front la pide con estrellas: la escala es el catálogo `ticket-priority`) |
| `status` | `status` | `enum` | NO | `new` (o `assigned` si ya trae responsable) | `new` \| `assigned` \| `in_progress` \| `pending_customer` \| `escalated` \| `resolved` \| `closed` \| `reopened` | Estado. **Solo cambia por una transición** (`POST /:uuid/transitions`), nunca por `PATCH` |
| `sla_response_minutes` / `sla_resolution_minutes` | (en `sla` de la respuesta) | `int` | NO | por prioridad | minutos HÁBILES | Plazos de SLA vigentes al crearse o al reclasificar |
| `resolution` | `resolution` | `varchar(2000)` | SÍ | NULL | obligatoria al resolver | Solución documentada |
| `resolved_at` / `closed_at` | `resolvedAt` / `closedAt` | `timestamptz` | SÍ | NULL | — | Marcas del ciclo de vida |
| (derivado) | `attendedSince` | `timestamptz` | SÍ | NULL | solo en `assigned` / `in_progress` | Desde cuándo está en atención: arranca el reloj de la tarjeta. Sale del último evento de asignación o de paso a esos estados |
| `assignee_email` | `assigneeEmail` | `varchar(254)` | NO | `''` | email válido o vacío | Responsable (vacío = sin asignar). **Solo el equipo lo cambia** |
| `estimate_hours` | `estimateHours` | `smallint` | SÍ | NULL | entero 1–200 | Estimación |
| `due_date` | `dueDate` | `date` | SÍ | NULL | `'YYYY-MM-DD'` | Fecha límite (sin hora) |
| `notify_reporter` | `notifyReporter` | `boolean` | NO | `false` | — | Avisar al solicitante |
| `owner_uuid` | `ownerUuid` | `uuid` | NO | `created_by` | FK `users.uuid`, solo backend | **Titular** del ticket (quien lo creó). Base de las reglas de titular y de ReBAC |

> Auditoría heredada de `BaseEntity`: no se repite.

## Ciclo de vida

`new → assigned → in_progress ⇄ pending_customer → resolved → closed`, más `escalated` (N2/N3) y `reopened`. Los estados son
**variaciones de tres grupos** (`STATUS_GROUPS`; el tablero `GET /api/bff/board` devuelve 3 columnas y la variación va como insignia):

| Grupo | Estados |
|---|---|
| Nuevo | `new`, `reopened` |
| En atención | `assigned`, `in_progress`, `escalated`, `pending_customer` |
| Cerrado | `resolved`, `closed` |

Quién puede cada transición (por **rol**, no solo «equipo»): `agent` atiende y resuelve lo asignado y pasa a `pending_customer`;
`supervisor` asigna, ESCALA y pasa a `pending_customer`, pero NO atiende ni resuelve; `admin` todo; `customer` confirma el cierre
o reabre lo suyo; `system` (cierre a las 48 h, respuesta del cliente); el `auditor` no mueve nada. La tabla está en
`lifecycle/ticket-lifecycle.ts`; la respuesta
trae `nextStatuses` con lo que ESA persona puede hacer ahora. Resolver exige documentar la solución. El solicitante confirma
el cierre o reabre; sin respuesta en **48 h** el sistema cierra. Un cerrado se reabre por reincidencia dentro de **7 días**.
Reglas de métricas y SLA: [metrics.md](../standard/metrics.md).

## Historial, comentarios, adjuntos y encuesta

| Recurso | Qué es | Endpoints |
|---|---|---|
| `ticket_events` | Historial **inmutable**: creación, asignaciones, cambios de estado, comentarios, encuesta. Solo se agrega | `GET /api/tickets/:uuid/events` |
| Comentarios | Evento `COMMENT_PUBLIC` (lo ve el solicitante) o `COMMENT_INTERNAL` (nota del equipo). **No se editan ni se borran** (409 `STCK-E002`); la corrección es otro comentario. Un ticket cerrado no admite comentarios | `POST /:uuid/comments` |
| Adjuntos | Evidencia: imagen (PNG/JPEG/GIF/WebP), PDF o texto, ≤ 5 MB, ≤ 5 por comentario. El tipo se detecta por la FIRMA del contenido, no por el nombre; se descarga siempre como adjunto con `nosniff` y `no-store` | `POST /:uuid/attachments`, `GET /:uuid/attachments/:id` |
| `ticket_surveys` | Encuesta CSAT: una por ticket, enviada al cerrar (correo + aviso), vigente 7 días, sin recordatorios; 1–5 y comentario opcional | `GET`/`POST /:uuid/survey` (solo el solicitante) |
| Asignación | Supervisor/administrador asignan o reasignan; un agente solo toma uno SIN responsable | `POST /:uuid/assign` |

## Validaciones (DTO Zod)

| Campo | Create (`TicketCreateSchema`) | Update (`TicketUpsertSchema`) | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|---|
| `title` | obligatorio | obligatorio | `trim().min(3).max(120)` | `GENERIC.MIN_LENGTH`, `GENERIC.MAX_LENGTH` |
| `description` | obligatorio (`''` válido) | obligatorio | `trim().max(2000)` | `GENERIC.MAX_LENGTH` |
| `department` | opcional (default `it`) | opcional (default `it`) | texto 1–40, elemento activo del catálogo | `GENERIC.REQUIRED_SELECTION`, `GENERIC.MAX_LENGTH` |
| `type` | obligatorio | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `category` | obligatorio | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `complexity` | opcional (default `null`) | opcional (se conserva si no viene) | enum o `null` | `GENERIC.REQUIRED_SELECTION` |
| `otherCategoryDetail` | condicional | condicional | `max(120)` + refine si `other` | `GENERIC.MAX_LENGTH`, `TICKET.OTHER_CATEGORY_DETAIL_REQUIRED` |
| `priority` | obligatorio | obligatorio | enum | `GENERIC.REQUIRED_SELECTION` |
| `status` | — (lo fija el sistema) | — (no se edita) | — | — |
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
| `TICKET_STATUS` | `new`, `assigned`, `in_progress`, `pending_customer`, `escalated`, `resolved`, `closed`, `reopened` | `lifecycle/ticket-lifecycle.ts` |
| `STATUS_GROUPS` | `new`, `in_attention`, `closed` (columnas del tablero) | `lifecycle/ticket-lifecycle.ts` |
| `TICKET_TYPE` | `incident`, `service_request`, `inquiry`, `improvement` | `schemas/ticket.schema.ts` |
| `TICKET_COMPLEXITY` | `simple`, `moderate`, `complex` | `schemas/ticket.schema.ts` |
| `TICKET_PRIORITY` | `low`, `medium`, `high`, `critical` | `schemas/ticket.schema.ts` |
| `TICKET_CATEGORY` | `hardware`, `software`, `network`, `access`, `email`, `other` | `schemas/ticket.schema.ts` |

## Permisos (CASL)

Reglas completas y precedencia: [authorization.md](../standard/authorization.md). Seed de `role_permissions`:

| Rol | Acciones | Condiciones |
|---|---|---|
| `ADMIN` | `manage` | — · es el ÚNICO que elimina y restaura |
| `SUPERVISOR` | `read`, `create`, `update` | asigna y escala; no resuelve |
| `AGENT` | `read`, `create`, `update` | `update` solo si `assigneeEmail` = su correo (`ASSIGNED_TO_ME`) |
| `AUDITOR` | `read` | solo lectura de todo; no modifica nada |
| `VIEWER` (cliente) | `create` | — |
| Titular (cualquier rol) | `read`, `update` | `ownerUuid` = yo. **No elimina ni restaura** |
| Titular (excepto cliente y auditor) | gestionar sus relaciones | el cliente NO maneja los accesos a un ticket: compartir es del equipo |
| Alternante | lo concedido (`canRead`/`canUpdate`) | `ownerUuid ∈ titulares`, recortado por el techo del rol. Eliminar nunca se concede |

## Reglas de negocio derivadas

- `otherCategoryDetail` solo se persiste si `category = 'other'`; en otro caso se guarda NULL.
- `code` es secuencial y lo asigna `TicketsRepository.nextCode()`; el cliente nunca lo envía.
- Un ticket eliminado no aparece en `findAll` salvo `includeDeleted=true`.
- `ownerUuid` = `createdBy` al crear; el cliente nunca lo envía.
- Al asignar (alta o cambio de `assigneeEmail`) se notifica al asignado (`TICKET_ASSIGNED`). Si edita un alternante con `notifyTitular`, se notifica al titular (`TICKET_CHANGED_BY_ALTERNANTE`).
