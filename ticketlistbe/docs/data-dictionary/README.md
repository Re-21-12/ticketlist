# Diccionario de datos — ticketlistbe

Catálogo de entidades, campos, tipos, restricciones, validaciones y errores del modelo. Se
mantiene **junto al código** (misma regla que wallet-api): al tocar una entidad o su schema Zod,
se actualiza aquí en el mismo cambio.

## Índice de entidades

| Entidad | Archivo | Módulo | Estado |
|---|---|---|---|
| `tickets` | `src/modules/tickets/ticket.entity.ts` | tickets | ✔ [tickets.md](tickets.md) |
| `users` | `src/modules/users/users.seed.ts` (`ISessionUser`) | users | ✔ [users.md](users.md) |
| `role_permissions` | `src/modules/access-control/role-permissions/role-permission.entity.ts` | access-control | ✔ [role-permissions.md](role-permissions.md) |
| `relationships` (+ `grants`) | `src/modules/relationships/relationship.entity.ts` | relationships | ✔ [relationships.md](relationships.md) |
| `notifications` | `src/modules/notifications/notification.entity.ts` | notifications | ✔ [notifications.md](notifications.md) |

## Convenciones

- Un archivo por entidad: `docs/data-dictionary/<entidad>.md` (kebab-case), copiado de [_template.md](_template.md).
- Columna (BD) en `snake_case` y campo (entity/DTO) en `camelCase`. Hoy el repositorio es en memoria: la columna documentada es la que tendrá la migración al conectar el ORM.
- Fechas sin hora (`date`) viajan como `'YYYY-MM-DD'`, nunca como ISO con hora (se corre el día por UTC).
- **Validaciones:** cada campo remite a la clave de `VALIDATION_ERRORS` que produce su mensaje. El mapeo completo campo → regla → `code` → mensaje está en [error-catalog.md §4.2](../standard/error-catalog.md).
- **Errores del módulo:** se listan los códigos que puede devolver el recurso. El detalle de cada código está en [error-catalog.md §3](../standard/error-catalog.md).
