# Autorización: RBAC + ABAC + ReBAC (titular / alternante) y notificaciones

> Lineamiento de wallet-api (`docs/standard/rbac.md`, `docs/features/titular-alternante.md`)
> adaptado a CASL. Código: `src/modules/auth/casl/casl-ability.factory.ts` (única fuente de reglas),
> `src/core/base.service.ts`, `src/modules/relationships/`, `src/modules/notifications/`.
> Tests: `test/app.e2e-spec.ts` → «RBAC (role_permissions)» y «Titular / Alternante».

## 1. Capas de reglas (`CaslAbilityFactory.rulesFor`)

Las reglas se **suman** (CASL: basta una regla que permita). No hay reglas `cannot`: el techo por
rol se aplica al **generar** las reglas ReBAC.

| # | Capa | Fuente | Qué concede |
|---|---|---|---|
| 1 | **RBAC + ABAC** | `role_permissions` (DB-first, editable por ADMIN en `/api/role-permissions`) | `(rol, subject, acción, preset)`. Preset: `NONE` (todo), `OWN` (`ownerUuid = yo`), `ASSIGNED_TO_ME` (`assigneeEmail = mi correo`) |
| 2 | **Titular** | fija en código | Sobre SUS tickets (`ownerUuid = yo`): read/update. **No delete ni restore** (solo el administrador elimina). Crear relaciones y gestionar las suyas (`titularUuid = yo`), salvo cliente y auditor: no manipulan los accesos |
| 3 | **ReBAC** | relaciones ACTIVAS donde soy alternante | `Ticket` con `ownerUuid ∈ [titulares que me concedieron X]`, por acción, **recortado por el techo del rol** |
| 4 | **Autoservicio** | fija en código | Mis notificaciones (`recipientUuid = yo`: read/update). Ver las relaciones donde soy alternante |

**Precedencia (wallet-api §3):** el titular siempre puede sobre lo suyo, aunque un ADMIN le quite
el permiso de rol. RBAC gobierna el acceso general. ReBAC solo agrega acceso a filas de otros
titulares y nunca supera el techo del rol.

### Seed de `role_permissions`

| Rol | Subject | Acción | Preset |
|---|---|---|---|
| ADMIN | all | manage | NONE |
| AGENT (N1) | Ticket | read, create | NONE |
| AGENT | Ticket | update | ASSIGNED_TO_ME |
| AGENT | MyMetric | read | NONE |
| SUPERVISOR | Ticket | read, create, update | NONE |
| SUPERVISOR | Metric, MyMetric, User | read | NONE |
| AUDITOR | Ticket, Metric, AuditLog, User | read | NONE |
| VIEWER (CLIENTE) | Ticket | create | NONE |

El **auditor** (`AUDITOR`) es de solo lectura: ve tickets (y sus notas internas), métricas y auditoría; no crea, edita, mueve ni elimina.
El **cliente** (`VIEWER`) solo tiene `create`: lo demás sale de la capa de titular (ve y sigue SUS tickets) y de lo que otra
persona le comparta. El **supervisor** ve las métricas del equipo (`Metric`); cada **agente**, las suyas (`MyMetric`).
Sobre un ticket, el papel de cada persona (solicitante y/o equipo) lo decide `TicketHistoryService.actorsFor`: un AGENTE es
«equipo» solo de los tickets que tiene asignados; ADMIN y SUPERVISOR, de cualquiera. Los poderes de cada rol sobre el flujo (el
soporte resuelve y pide información; el supervisor asigna, escala y pide información, no resuelve; solo el administrador elimina)
están en `lifecycle/ticket-lifecycle.ts` (`TRANSITIONS`) y se prueban en `test/ticket-permissions.e2e-spec.ts`.

## 2. Dónde se evalúa

| Nivel | Dónde | Qué responde |
|---|---|---|
| Tipo | `CaslGuard` + `@CheckAbility(acción, subject)` | 403 `SAUT-E001` si no hay NINGUNA regla para ese tipo |
| Fila (lectura) | `BaseService.readableRowFilter()` en `findAll` y `findOrFail` | Las filas no legibles no aparecen en listados. Un GET directo responde **404** (no se revela que existen) |
| Fila (escritura) | `BaseService.assertCan()` en update/delete/restore | 403 `SAUT-E001` |
| Front | reglas del shell (`GET /api/bff/shell`) → `AbilityServiceSignal` + `CanPipe` | Oculta acciones. **Solo UX**: el backend decide |

> El guard evalúa por TIPO: `can('read','Ticket')` es verdadero con cualquier regla condicionada.
> Por eso la lectura por fila es obligatoria en el servicio (ver [rfc-audit.md §2.4](rfc-audit.md#24-autorización-a-nivel-de-fila-bug-encontrado-durante-esta-auditoría)).

## 3. Titular / alternante (ReBAC)

- **Titular:** dueño de la fila (`ticket.ownerUuid`, lo asigna `createdBy` al crear).
- **Alternante:** persona a la que el titular concede acceso a SUS filas.

### Relación y concesiones

`POST /api/relationships` `{ alternanteEmail, grants[], consent: true }`. Cada concesión es por tipo de recurso:

| Campo | Default | Significado |
|---|---|---|
| `objectType` | — | Recurso compartido (hoy `Ticket`) |
| `canRead` / `canUpdate` | `true` / `false` | Lo concedido (crear no aplica: lo creado es de quien lo crea; **eliminar nunca se concede**: es solo del administrador) |
| `notifyTitular` | `true` | Avisar al titular cuando el alternante cambie algo |
| `consentVersion` / `consentedAt` | servidor | Texto de consentimiento aceptado y cuándo (auditoría) |

### Reglas de negocio

| Regla | Código |
|---|---|
| Sin `consent: true` no se crea ni se cambia | 400 `CVAL-E001` |
| No se comparte con uno mismo | 422 `SREL-E001` |
| El alternante debe existir | 422 `SREL-E002` |
| Una sola relación ACTIVA por par titular→alternante | 409 `SREL-E003` |
| Solo el titular cambia concesiones o revoca | 403 `SREL-E004` |
| Revocar = `status REVOKED` + `endedAt` (histórico, no se borra). El acceso se pierde en la siguiente request | — |

### Techo por rol (`ALTERNANTE_ROLE_CEILING`)

| Rol del alternante | Techo | Efecto |
|---|---|---|
| ADMIN, SUPERVISOR, AGENT | `managed` | Recibe lo concedido |
| AUDITOR, VIEWER | `read` | `canUpdate` se ignora: ni el auditor ni el cliente escriben por una concesión |

## 4. Notificaciones (in-app)

`NotificationsService.notify()` **nunca lanza** (un fallo al notificar no revierte la operación) y
**omite al propio actor** (nadie se notifica a sí mismo).

| Tipo | Destinatario | Cuándo |
|---|---|---|
| `TICKET_ASSIGNED` | el asignado (`assigneeEmail`) | Alta o cambio de asignado |
| `TICKET_CHANGED_BY_ALTERNANTE` | el titular | Un alternante edita un ticket del titular y la concesión tiene `notifyTitular` |
| `RELATIONSHIP_GRANTED` | el alternante | Alta o cambio de concesiones |
| `RELATIONSHIP_REVOKED` | el alternante | Revocación |

Endpoints: `GET /api/notifications` (solo las mías) · `PATCH /api/notifications/:uuid/read`
(ajena o inexistente → 404 `RNTF-E001`).

## 5. Diferencias con wallet-api

| Tema | wallet-api | ticketlistbe |
|---|---|---|
| Motor | guard propio + `getReadScope()` + RLS PostgreSQL | CASL (mismas reglas en back y front) |
| ReBAC | se resuelve en el service + RLS | se proyecta al Ability (`ownerUuid $in`): el front muestra «Editar» exactamente cuando el back lo permitirá |
| Canales | in-app + Web Push + email | solo in-app |
| Defensa en profundidad | RLS | pendiente hasta tener BD ([rfc-audit.md §3](rfc-audit.md#3-pendientes)) |
