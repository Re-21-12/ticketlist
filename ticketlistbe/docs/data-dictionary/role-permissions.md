# role_permissions — Diccionario de datos

> Basado en `src/modules/access-control/role-permissions/role-permission.entity.ts` y
> `schemas/role-permission.schema.ts`. Equivale a `role_permissions` de wallet-api.

## Descripción

RBAC DB-first: cada fila dice «el rol R puede A sobre S bajo la condición C». Solo ADMIN la
gestiona (`/api/role-permissions`). Un cambio rige desde la **siguiente request**. Borrado lógico.

## Campos

| Columna (BD) | Campo | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `role` | `role` | `enum` | NO | — | `ADMIN` \| `AGENT` \| `VIEWER` | Rol |
| `subject` | `subject` | `enum` | NO | — | `SUBJECTS` | Recurso |
| `action` | `action` | `enum` | NO | — | `EAbility` | Acción |
| `condition` | `condition` | `enum` | NO | `NONE` | `NONE` \| `OWN` \| `ASSIGNED_TO_ME` | Preset ABAC (lista cerrada, no JSON libre) |

## Validaciones (DTO Zod)

| Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|
| `role`, `subject`, `action`, `condition` | enum | `GENERIC.REQUIRED_SELECTION` |

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `SAUT-E001` | 403 | todos | Quien llama no es ADMIN |
| `RRPM-E001` | 404 | `/:uuid` | Permiso inexistente |
| `RRPM-E002` | 409 | POST, PATCH | Duplicado `(role, subject, action, condition)` |

## Índices

| Nombre | Columnas | Tipo | Justificación |
|---|---|---|---|
| `UQ_role_permissions_rule` | `role, subject, action, condition` WHERE NOT `is_deleted` | UNIQUE parcial | Sin reglas duplicadas |
| `IDX_role_permissions_role` | `role` | plain | `findActiveByRole` en cada request |

## Semilla y reglas

Ver [authorization.md §1](../standard/authorization.md#1-capas-de-reglas-caslabilityfactoryrulesfor).
