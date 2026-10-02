# relationships (+ grants) — Diccionario de datos

> Basado en `src/modules/relationships/relationship.entity.ts` y `schemas/relationship.schema.ts`.
> Equivale a `relationships` + `relationship_grants` de wallet-api.

## Descripción

Vínculo **titular → alternante**: el titular comparte SUS filas con otra persona, con CRUD
granular por tipo de recurso y consentimiento explícito. Revocar no borra: pasa a `REVOKED` con
`ended_at` (el historial se conserva).

## Campos — `relationships`

| Columna (BD) | Campo | Tipo | Nulo | Default | Restricciones | Descripción |
|---|---|---|---|---|---|---|
| `uuid` | `uuid` | `uuid` | NO | generado | UNIQUE | Identificador público |
| `titular_uuid` | `titularUuid` | `uuid` | NO | usuario en sesión | FK `users` | Quien comparte |
| `alternante_uuid` | `alternanteUuid` | `uuid` | NO | — | FK `users`, ≠ titular | Quien recibe |
| `status` | `status` | `enum` | NO | `ACTIVE` | `ACTIVE` \| `REVOKED` | Estado |
| `ended_at` | `endedAt` | `timestamptz` | SÍ | NULL | — | Fin de la relación |

## Campos — `relationship_grants` (1:N)

| Columna (BD) | Campo | Tipo | Nulo | Default | Descripción |
|---|---|---|---|---|---|
| `object_type` | `objectType` | `enum` | NO | — | `Ticket` |
| `can_read` | `canRead` | `boolean` | NO | `true` | Leer |
| `can_update` | `canUpdate` | `boolean` | NO | `false` | Editar (con techo por rol). **Eliminar no se concede**: es solo del administrador |
| `notify_titular` | `notifyTitular` | `boolean` | NO | `true` | Avisar al titular de los cambios |
| `consent_version` | `consentVersion` | `varchar` | NO | `CURRENT_CONSENT_VERSION` | Texto aceptado |
| `consented_at` / `consented_by` | `consentedAt` / `consentedBy` | `timestamptz` / `uuid` | NO | servidor | Auditoría del consentimiento |

## Validaciones (DTO Zod)

| Campo | Regla | Clave de `VALIDATION_ERRORS` |
|---|---|---|
| `alternanteEmail` | `email()` (se normaliza a minúsculas) | `GENERIC.IS_EMAIL` |
| `grants` | `array().min(1)` | `RELATIONSHIP.GRANTS_REQUIRED` |
| `grants[].objectType` | enum | `GENERIC.REQUIRED_SELECTION` |
| `consent` | `literal(true)` | `RELATIONSHIP.CONSENT_REQUIRED` |

## Administración (`/api/relationships/admin`)

Exige `manage Relationship` (ADMIN). `GET` lista TODAS las relaciones con nombre y correo de ambas personas, estado y lo concedido (filtros `status`, `search`, paginación). `DELETE /:uuid` revoca cualquier relación activa: no borra (queda `REVOKED` con `endedAt`) y avisa a titular y alternante. Un titular común solo ve y gestiona las suyas en `/api/relationships`.

## Errores del módulo

| Código | HTTP | Endpoint(s) | Cuándo |
|---|---|---|---|
| `RREL-E001` | 404 | PATCH `/:uuid/grants`, DELETE `/:uuid`, DELETE `/admin/:uuid` | Inexistente, ajena o ya revocada |
| `SREL-E001` | 422 | POST | Compartir consigo mismo |
| `SREL-E002` | 422 | POST | El correo del alternante no existe |
| `SREL-E003` | 409 | POST | Ya hay una relación ACTIVA con esa persona |
| `SREL-E004` | 403 | PATCH `/:uuid/grants`, DELETE `/:uuid` | Lo intenta el alternante |

## Índices

| Nombre | Columnas | Tipo | Justificación |
|---|---|---|---|
| `UQ_relationships_active_pair` | `titular_uuid, alternante_uuid` WHERE `status = 'ACTIVE'` | UNIQUE parcial | Una relación activa por par |
| `IDX_relationships_alternante` | `alternante_uuid, status` | plain | `findActiveAsAlternante` en cada request (ReBAC) |

## Reglas

Ver [authorization.md §3](../standard/authorization.md#3-titular--alternante-rebac).
