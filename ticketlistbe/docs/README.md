# Documentación — ticketlistbe

Documentación viva: se actualiza **en el mismo cambio** que el código que describe (misma regla
que wallet-api). Lo que se puede generar desde el código se genera, y un test verifica que no
quede desactualizado.

| Documento | Qué cubre | Cómo se mantiene |
|---|---|---|
| [standard/error-catalog.md](standard/error-catalog.md) | Códigos de error por capa (BD, servicio, controlador/DTO, sistema), mensajes es/en, mapeo campo → regla → mensaje de cada DTO | §3 y §4.1 generados (`bun run docs:errors`); §4.2 y §5 a mano. Lo verifica `error-catalog.docs.spec.ts` |
| [standard/http-status-codes.md](standard/http-status-codes.md) | Qué status HTTP emite la API y con qué semántica (RFC 9110) | A mano; lo respaldan los e2e |
| [standard/observability.md](standard/observability.md) | Almacén clave-valor (memoria/Redis), `X-Request-Id` y logs, rate limiting, health checks, apagado ordenado, 405 | A mano; `platform.e2e-spec.ts` y `kv-store.contract.spec.ts` |
| [standard/rfc-audit.md](standard/rfc-audit.md) | Auditoría RFC: lineamiento de wallet-api vs. estado aquí (9457, 9110, 9111, 6265, 6901) | A mano; cada fila cita su e2e |
| [standard/cookies-session.md](standard/cookies-session.md) | Sesión stateful, cookies `sid` / `XSRF-TOKEN`, CSRF, usuarios de desarrollo | A mano; e2e «Sesión y cookies» |
| [standard/http-caching.md](standard/http-caching.md) | `Cache-Control`, ETag, 304 y concurrencia optimista (412) | A mano; e2e «Caché y concurrencia» |
| [standard/metrics.md](standard/metrics.md) | FCR, SLA (primera respuesta y resolución por criticidad) y CSAT: metas, fórmulas exactas, eventos de origen, supuestos y plan | A mano; las pruebas del módulo `metrics` (pendiente) fijarán cada fórmula |
| [standard/persistence.md](standard/persistence.md) | Persistencia con TypeORM + Postgres: modelo (lecturas en memoria, escritura en cola), tablas, migraciones, semillas idempotentes, comandos | A mano; `persistence.e2e-spec.ts` (`bun run test:pg`) |
| [standard/authorization.md](standard/authorization.md) | RBAC + ABAC + ReBAC (titular / alternante), techo por rol, notificaciones | A mano; e2e «RBAC» y «Titular / Alternante» |
| [design/auth-flows.md](design/auth-flows.md) | Verificación de correo, recuperación, TOTP, códigos de respaldo, WebAuthn, sesiones y rate limiting, con diagramas | A mano; se actualiza con cada flujo implementado |
| [design/web-push-pwa.md](design/web-push-pwa.md) | SSE, Web Push y PWA: cómo funciona cada pieza y qué se agrega | A mano |
| [data-dictionary/](data-dictionary/README.md) | Entidades: campos, tipos, restricciones, validaciones del DTO y errores del módulo | A mano, un archivo por entidad (`_template.md`) |
| Referencia de la API | Endpoints, schemas y respuestas de error | **Automática**: Scalar UI en `/api/reference`, JSON en `/api/openapi.json` (generado desde los schemas Zod) |

## Reglas de sincronización

1. **Nuevo código de error o mensaje de validación:** `bun run docs:errors` y completar §4.2 / §5 del catálogo. `bun run test` falla hasta que esté documentado.
2. **Cambio en una entidad o en su schema Zod:** actualizar `data-dictionary/<entidad>.md` en el mismo cambio.
3. **Endpoint nuevo:** decorar con `@ApiZodBody` / `@ApiZodResponse` (incluidas las respuestas de error con su código). Así aparece en Scalar sin documentación aparte.
