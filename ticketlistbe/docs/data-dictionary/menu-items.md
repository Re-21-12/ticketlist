# menu_items — Diccionario de datos

> Basado en `src/modules/menu-items/menu-item.entity.ts` y `schemas/menu-item.schema.ts`. Equivale a `menu_items` de wallet-api.

## Descripción

Catálogo del menú lateral, administrable (`/api/menu-items`, solo ADMIN). `GET /api/bff/shell` entrega los ítems **activos** ordenados por `order`; QUIÉN ve cada uno lo decide CASL en el front con `subject` + `requiredAction`. Borrado lógico. Un cambio rige desde la siguiente carga del shell.

## Campos

| Columna | Campo | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador |
| `key` | `key` | `varchar(40)` | NO | — | `^[a-z][a-z0-9-]*$`, único entre vigentes | Clave estable |
| `label` | `label` | `varchar(60)` | NO | — | 2–60 | Texto visible |
| `route` | `route` | `varchar(200)` | NO | — | ruta INTERNA: una sola `/` inicial, sin esquema ni `\` | Destino (anti open-redirect) |
| `group` | `group` | `varchar(40)` | SÍ | NULL | ≤ 40 | Encabezado de grupo |
| `icon` | `icon` | `varchar` | SÍ | NULL | `^pi-[a-z0-9-]{1,40}$` | Clase PrimeIcons |
| `subject` | `subject` | `enum` | SÍ | NULL | `SUBJECTS` | Recurso CASL; NULL = cualquier sesión |
| `required_action` | `requiredAction` | `enum` | SÍ | NULL | `EAbility` | Acción CASL (default leer) |
| `order` | `order` | `int` | NO | 100 | 0–999 | Orden |
| `active` | `active` | `boolean` | NO | `true` | — | Visible |

## Errores

| Código | HTTP | Cuándo |
|---|---|---|
| `SAUT-E001` | 403 | No es ADMIN |
| `RMNU-E001` | 404 | Ítem inexistente |
| `RMNU-E002` | 409 | `key` repetida |
| `RMNU-E003` | 410 | GET de un ítem eliminado |

Validaciones con `VALIDATION_ERRORS.ADMIN.*` (`INVALID_KEY`, `INVALID_ROUTE`, `INVALID_ICON`).
