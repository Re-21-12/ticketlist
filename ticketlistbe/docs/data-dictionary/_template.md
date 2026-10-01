# <Entidad> — Diccionario de datos

> Copia este archivo como `docs/data-dictionary/<entidad>.md`. Basado en
> `src/modules/<modulo>/<entidad>.entity.ts` y `src/modules/<modulo>/schemas/<entidad>.schema.ts`.
> Actualizar en el mismo cambio que toque la entidad o su schema.

## Descripción

<Rol de la entidad, a quién pertenece y ciclo de vida (borrado lógico, restauración…).>

## Campos

| Columna (BD) | Campo (entity/DTO) | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `<columna>` | `<campo>` | `<tipo>` | SÍ/NO | — | — | — |

> Columnas de auditoría heredadas de `BaseEntity` (`id`, `created_at`, `created_by`, `updated_at`,
> `updated_by`, `deleted_at`, `deleted_by`, `is_deleted`, `restored_at`, `restored_by`): no se repiten.

## Validaciones (DTO Zod)

| Campo | Create | Update | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|---|---|
| `<campo>` | obligatorio / opcional (default) | obligatorio | `.min(3)` | `GENERIC.MIN_LENGTH` |

> Mensaje resultante y `code` de cada regla: [error-catalog.md §4.2](../standard/error-catalog.md).

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `R<MOD>-E001` | 404 | GET/PATCH/DELETE `/:uuid` | No existe o fuera del alcance de lectura |

## Índices

| Nombre | Columnas | Tipo | Justificación |
|---|---|---|---|

## Relaciones

| Campo | Tipo | Entidad destino | ON DELETE | Descripción |
|---|---|---|---|---|

## Enums / constantes de dominio

| Constante | Valores | Ubicación |
|---|---|---|

## Permisos (CASL)

| Rol | Acciones | Condiciones |
|---|---|---|

## Reglas de negocio derivadas

- <Reglas que no son constraint de BD.>
