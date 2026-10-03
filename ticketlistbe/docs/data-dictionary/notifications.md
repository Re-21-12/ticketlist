# notifications — Diccionario de datos

> Basado en `src/modules/notifications/notification.entity.ts` y `schemas/notification.schema.ts`.

## Descripción

Avisos in-app por persona. Los crea el backend (`NotificationsService.notify`, que nunca lanza y
omite al propio actor). El destinatario solo puede listarlos y marcarlos como leídos.

## Campos

| Columna (BD) | Campo | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `recipient_uuid` | `recipientUuid` | `uuid` | NO | — | FK `users` | Destinatario |
| `type` | `type` | `enum` | NO | — | `NOTIFICATION_TYPES`: `TICKET_ASSIGNED`, `TICKET_CHANGED_BY_ALTERNANTE`, `RELATIONSHIP_GRANTED`, `RELATIONSHIP_REVOKED`, `TICKET_STATUS_CHANGED`, `TICKET_COMMENTED`, `TICKET_REOPENED`, `TICKET_SURVEY` (encuesta para quien solicitó el ticket cerrado), `TICKET_SURVEY_ALERT` (calificación baja, a supervisores), `ACCOUNT_LOCKED` (cuenta bloqueada, a administradores) | Tipo de evento |
| `message` | `message` | `varchar(300)` | NO | — | — | Texto visible |
| `resource_type` | `resourceType` | `enum` | SÍ | NULL | `Ticket` \| `Relationship` | Recurso relacionado (para navegar) |
| `resource_uuid` | `resourceUuid` | `uuid` | SÍ | NULL | — | uuid del recurso |
| `read_at` | `readAt` | `timestamptz` | SÍ | NULL | — | NULL = no leída |

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `SAUT-E002` | 401 | todos | Sin sesión |
| `RNTF-E001` | 404 | PATCH `/:uuid/read` | Inexistente o de otra persona |

## Índices

| Nombre | Columnas | Tipo | Justificación |
|---|---|---|---|
| `IDX_notifications_recipient_read` | `recipient_uuid, read_at` | plain | Listado y contador de no leídas |

## Tipos

Ver [authorization.md §4](../standard/authorization.md#4-notificaciones-in-app).

## Tiempo real (SSE)

`GET /api/notifications/stream` entrega cada notificación NUEVA del usuario de la sesión como evento `notification` (más un `ping` cada 25 s). Detalle, límites (una sola réplica) y reconexión en [standard/notifications.md](../standard/notifications.md).
