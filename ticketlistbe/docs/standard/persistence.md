# Persistencia: TypeORM + Postgres

El dominio (usuarios, permisos por rol, menú, catálogos, tickets con su historial, adjuntos y encuestas, notificaciones y relaciones) se guarda en **Postgres con TypeORM**. La auditoría sigue en su propio almacén (`PostgresAuditLogStore`) pero su tabla también la crea una migración.

Código: `src/database/` · Tests: `test/persistence.e2e-spec.ts` (`bun run test:pg`).

## 1. Cómo funciona (modelo)

```
 request ──► servicio ──► repositorio ──► copia EN MEMORIA  (lecturas, síncronas)
                                   └────► PersistenceService ──► cola ordenada ──► Postgres (TypeORM)
 arranque:  migraciones ──► cada repositorio se HIDRATA de la base y le suma sus semillas faltantes
```

- Las **lecturas** salen de memoria (servicios, guards y CASL son síncronos); cada **escritura** se encola y se guarda en el orden en que ocurrió.
- **La base es la fuente de verdad**: al reiniciar o redesplegar se recupera todo. Al apagar (`SIGTERM`) se espera a que la cola termine.
- **Una sola instancia de la API.** Dos réplicas tendrían copias en memoria que divergen (la sesión y los contadores ya van a Redis; el dominio todavía no). Para escalar horizontalmente hay que pasar los repositorios a lecturas directas con TypeORM (es el siguiente paso natural; los servicios hoy son síncronos).
- Si una escritura falla, se registra y `GET /api/health/ready` responde 503 (`postgres no responde o falló una escritura`): el orquestador le quita tráfico.
- Sin `DATABASE_URL` (o con `DB_PERSISTENCE=false`) todo funciona solo en memoria (así corren las pruebas).

## 2. Variables

| Variable | Default | Qué hace |
|---|---|---|
| `DATABASE_URL` | — | Conexión Postgres. **Obligatoria en production.** |
| `DB_PERSISTENCE` | activa si hay `DATABASE_URL` (salvo `NODE_ENV=test`) | `false` = solo memoria (prohibido en production) |
| `DB_AUTO_MIGRATE` | `true` | Aplica las migraciones pendientes al arrancar (idempotente). `false` si las corre otro paso. |
| `DB_RESET_ON_START` | `false` | **Solo pruebas**: vacía las tablas al conectar (prohibido en production). |
| `DB_LOGGING` | `false` | `true` registra cada consulta. |

## 3. Tablas

`users` · `role_permissions` · `menu_items` · `notifications` · `relationships` (concesiones en `jsonb`) · `tickets` · `ticket_events` (historial inmutable, solo inserts) · `ticket_attachments` (contenido `bytea`) · `ticket_surveys` · `catalogs` · `catalog_items` · `audit_logs`.

- Columnas en `snake_case` (`SnakeNamingStrategy`), `timestamptz`, clave primaria `uuid` (las filas con `BaseEntity` conservan `id` como contador propio).
- Las claves foráneas **no** se declaran: la integridad la mantiene la capa de servicio (como antes) y las semillas entran en el orden del arranque. Los índices sí (dueño, estado, responsable, departamento, historial por ticket…).
- Los esquemas viven en `src/database/entity-schemas.ts` (`EntitySchema`, sin decoradores en las clases de dominio).

## 4. Migraciones

`synchronize` está **siempre apagado**: el esquema solo cambia por migraciones (`src/database/migrations/`, lista explícita en `index.ts`).

```bash
bun run migration:run        # aplica las pendientes (la app también lo hace al arrancar)
bun run migration:show       # cuáles están aplicadas
bun run migration:revert     # deshace la última

# cambiaste un EntitySchema → genera la migración comparando con la base:
bun run migration:generate src/database/migrations/NombreDelCambio
#   (con la base local al día: `docker compose up -d postgres`; revisa el SQL y AGREGA la clase a MIGRATIONS en index.ts)
bun run migration:create src/database/migrations/Manual   # una vacía, para datos o SQL a mano
```

`DATABASE_URL` por defecto para la CLI: `postgres://ticketit:ticketit-dev@localhost:5433/ticketit` (el Postgres de `docker-compose.yml`).

Regla del equipo: **nunca editar una migración ya publicada**; un cambio es una migración nueva.

## 5. Semillas (idempotentes, en cada arranque)

| Dato | Regla |
|---|---|
| Permisos por rol, menú, catálogos y sus elementos | **`ensure`**: se INSERTAN los que falten por clave natural (rol+recurso+acción+condición · `key` · catálogo+`code`). Lo que un administrador editó, desactivó o eliminó **no se pisa**; un lanzamiento que agrega un ítem lo recibe solo. |
| Usuarios iniciales (`SEED_USERS_JSON`, `BOOTSTRAP_ADMIN_*` o la demostración) | Solo entran las cuentas cuyo **correo no existe**: una contraseña que la persona cambió nunca se sobrescribe. |
| Tickets, historial y encuestas de demostración | Solo si la tabla está **vacía** (y solo con `SEED_DEMO_DATA`). |

No hay un comando `seed` aparte: el arranque ya lo hace. Para que el primer arranque en production tenga sus cuentas por rol, ver `deploy/generate-secrets.mjs` y `docs/data-dictionary/users.md`.

## 6. Desarrollo y pruebas

```bash
docker compose up -d postgres redis            # Postgres :5433 · Redis :6380
DATABASE_URL=postgres://ticketit:ticketit-dev@localhost:5433/ticketit bun run start:dev   # persiste en Postgres
bun run test:pg                                 # unit + e2e con Postgres real (incluye persistence.e2e-spec.ts)
```

`persistence.e2e-spec.ts` arranca una instancia, escribe (alta de cuenta, ticket, comentario, asignación, edición de catálogo), la apaga, arranca **otra** y verifica que todo se recuperó, que nada se duplicó y que la numeración continúa.
