# catalogs / catalog_items — Diccionario de datos

> Basado en `src/modules/catalogs/`. Equivale a las «tablas dinámicas» (catalogs) de wallet-api.

## Descripción

Listas de valores administrables (`/api/catalogs`). Los de **sistema** (`ticket-type`, `ticket-category`, `ticket-priority`, `ticket-complexity`, `ticket-department`, `ticket-status`) espejan los enums que valida el schema de tickets: sus códigos y su estado «activo» no cambian y no se eliminan, pero etiqueta y orden sí. `GET /api/catalogs/:key/options` lo puede pedir cualquier sesión (solo ítems activos); el resto exige `Catalog`.

## Campos — `catalogs`

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `key` | `varchar(40)` | `^[a-z][a-z0-9-]*$`, único; inmutable | Identificador |
| `name` | `varchar(60)` | 2–60 | Nombre visible |
| `description` | `varchar(200)` | ≤ 200 | Texto de ayuda |
| `system` | `boolean` | solo semilla | Catálogo de sistema |

## Campos — `catalog_items`

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `uuid` | `uuid` | UNIQUE | Identificador |
| `code` | `varchar(40)` | `^[A-Za-z][A-Za-z0-9_]*$`, único por catálogo sin distinguir mayúsculas | Valor que se guarda |
| `label` | `varchar(80)` | 1–80 | Etiqueta |
| `order` | `int` | 0–999 | Orden |
| `active` | `boolean` | — | Se ofrece en formularios |
| `icon` | `varchar(43)` | `^pi-[a-z0-9-]{1,40}$` o NULL | Ícono PrimeIcons de la insignia (decorativo: el texto siempre acompaña) |
| `severity` | `enum` | `secondary` \| `info` \| `success` \| `warn` \| `danger` \| `contrast` o NULL | Color de la insignia (sigue el tema claro/oscuro) |
| `system` | `boolean` | solo semilla | Elemento de sistema |

`ticket-department` es la excepción: sus elementos NO espejan un enum. Solo `it` («TI (interno)») es de sistema; los demás departamentos los agrega, renombra o desactiva la organización, y `TicketsService` valida contra ellos.

## Quién los consume

- `GET /api/bff/board` rotula las columnas con `ticket-status`.
- `GET /api/catalogs/:key/options` devuelve `{ value, label, icon, severity }`: con eso el front pinta insignias (tarjetas, tablas, selects) con el ícono y el color que administra el catálogo.
- El front (`CatalogOptionsService`) arma con `ticket-type`, `ticket-category`, `ticket-priority`, `ticket-complexity` y `ticket-status` los selects de los formularios de ticket, las columnas del listado y las etiquetas del tablero; si el catálogo no responde usa las etiquetas del contrato. Los CÓDIGOS siguen siendo los del schema Zod de tickets, por eso los de sistema no cambian de código ni se desactivan.

## Errores

| Código | HTTP | Cuándo |
|---|---|---|
| `RCAT-E001` | 404 | Catálogo inexistente |
| `RCAT-E002` | 404 | Elemento inexistente |
| `RCAT-E003` | 409 | Código repetido |
| `RCAT-E004` | 409 | Cambiar código/desactivar o eliminar algo de sistema |
| `RCAT-E005` | 409 | Clave de catálogo repetida |
