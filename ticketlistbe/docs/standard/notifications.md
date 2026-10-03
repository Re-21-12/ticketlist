# Notificaciones por ticket y tiempo real (CU01)

Caso de uso **CU01 «Control de estado y notificaciones por ticket»**: el usuario final consulta sus tickets con su estado actual y, cuando el equipo cambia algo, recibe un aviso automático. Este documento fija cómo se cumple en la API y en la pantalla.

| Paso del caso de uso | Dónde |
|---|---|
| Panel «Mis tickets»: lista con el estado actual | `GET /api/tickets?mine=true` · pantalla `/my-tickets` (front) |
| Detalle e historial de interacciones | `GET /api/tickets/:uuid/events` (comentarios, cambios de estado, asignaciones, avisos) |
| El equipo cambia el estado → aviso automático | `TicketLifecycleService.notifyRequester()` (bandeja + tiempo real + correo) |
| Quedan registradas en el historial del ticket (postcondición) | evento `NOTIFIED` en `ticket_events` |
| **A1** sin tickets | la lista llega vacía (`meta.total = 0`); la pantalla lo dice y ofrece «Crear un ticket» |
| **A2** falla la conexión en vivo | el front muestra una alerta de sincronización y permite «Actualizar» a mano |

## 1. Quién recibe qué

`NotificationsService.notify()` sigue siendo el único camino. `TicketLifecycleService.notifyRequester(ticket, mensaje)` avisa al **solicitante** de un cambio y además:

1. **Registra el evento `NOTIFIED`** (público, actor «Sistema», `body` = el mensaje) en el historial del ticket. El solicitante lo ve en su historial; el equipo también.
2. Manda un **correo** de mejor esfuerzo (`IMailService`): hoy el servicio solo escribe en el log hasta que se configure SMTP (ver `docs/design/auth-flows.md`). Nada depende de que llegue.

Avisan al solicitante: asignación («X atenderá tu solicitud»), «en atención» (solo si lo hace el equipo), «necesitamos más información», escalamiento, resuelto, reabierto por el equipo y cierre automático. **Nadie se notifica a sí mismo**: si el propio solicitante provoca el cambio, `notify()` devuelve `false` y no se registra ningún evento.

Los comentarios y las encuestas ya dejan su propio renglón en el historial (`COMMENT_PUBLIC`, `SURVEY_SENT`), por eso no generan un `NOTIFIED` aparte.

## 2. Tiempo real: SSE

`GET /api/notifications/stream` (`text/event-stream`, requiere sesión → 401 sin ella).

| Evento | Datos | Cuándo |
|---|---|---|
| `notification` | una `NotificationResponse` (la misma forma que `GET /api/notifications`) | cada notificación NUEVA del usuario de la sesión, ya guardada |
| `ping` | `{}` | cada 25 s, para que Traefik y los proxies no corten una conexión ociosa |

- **Solo las suyas**: el stream filtra por el usuario de la sesión; nunca ve avisos ajenos.
- La respuesta lleva `Cache-Control: no-store` y `X-Accel-Buffering: no`; `@NoHttpCache()` la excluye del `HttpCacheInterceptor` (no hay un cuerpo que hashear).
- Al apagar la API (`onApplicationShutdown`) los streams se cierran; sin eso una conexión abierta impediría que el servidor HTTP termine.
- El cliente usa `EventSource` (reconecta solo). **Al reconectar vuelve a pedir** `GET /api/notifications` y los tickets: un evento emitido durante la caída no se reenvía (no hay `Last-Event-ID`).

### Límites

- **Una sola réplica de la API**: la entrega es por proceso (`NotificationStreamService` publica en un `Subject`). Con varias réplicas, un aviso generado en una no llegaría a quien tiene el stream en otra: habría que publicar por Redis (`pub/sub`). Coincide con el límite de [persistence.md](persistence.md).
- Cada pestaña abierta es una conexión; el rate limit global por IP no cuenta las conexiones ya abiertas.
- Sin correo real (SMTP pendiente) el canal de correo del caso de uso no llega a nadie.

## 3. Front

- `core/realtime/notification-stream.service.ts`: `EventSource` + estado (`idle | connecting | live | offline`) + `events$` y `reconnected$`. En modo mock escucha el canal simulado (`mock-realtime.ts`).
- Campana del topbar (`layouts/layout/notification-panel`): se refresca con cada evento; sin conexión en vivo vuelve a consultar cada minuto como respaldo.
- `/my-tickets`: lista + detalle + historial; con cada aviso de un ticket vuelve a pedir lista e historial. Alerta de sincronización (A2) con «Actualizar ahora». `?ticket=<uuid>` abre ese ticket (lo usan los avisos de la campana).

## 4. Pruebas

`test/ticket-notifications.e2e-spec.ts`: filtro `mine`, A1, evento `NOTIFIED` en cada cambio, nadie se notifica a sí mismo, SSE real (conexión abierta recibe el aviso del cambio) y 401 sin sesión. En el front: `mock-bff.notifications.spec.ts` y `pages/my-tickets/my-tickets.spec.ts` (A1, historial, A2, actualización por aviso en vivo).
