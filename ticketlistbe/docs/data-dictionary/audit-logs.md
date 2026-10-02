# audit_logs — Diccionario de datos

> Basado en `src/modules/audit-log/`. Equivale a `audit_logs` de wallet-api.

## Descripción

Registro **inmutable** (solo lectura: `GET /api/audit-logs`, solo ADMIN) de toda mutación (POST/PUT/PATCH/DELETE), incluidas las que corta un guard (401/403/429) y los inicios/cierres de sesión. Lo escribe `AuditMiddleware` al terminar la respuesta. **Nunca** guarda valores del body ni la query: solo los NOMBRES de los campos enviados. Por defecto vive en memoria (tope 10 000, se pierde al reiniciar). Con `DATABASE_URL` se guarda en Postgres (`audit_logs`, creada al arrancar): la inmutabilidad es a nivel de API: el store solo expone `append` y lecturas y el controlador solo tiene GET (no hay ruta ni método que edite o borre); en producción conviene además quitarle UPDATE/DELETE sobre la tabla al rol de BD de la app. Un fallo al escribir se registra en el log y NUNCA rompe la request.

## Campos

| Campo | Tipo | Descripción |
|---|---|---|
| `uuid`, `at` | `uuid`, `timestamptz` | Identificador y momento |
| `action` | `CREATE` \| `UPDATE` \| `DELETE` \| `SIGN_IN` \| `SIGN_OUT` | Qué se hizo |
| `subject` | `varchar` | Primer segmento de la ruta (`users`, `tickets`…) |
| `route`, `method` | `varchar` | Plantilla (`/api/users/:uuid/role`), nunca la URL con datos |
| `resourceUuid` | `uuid` NULL | Recurso afectado |
| `status`, `outcome` | `int`, `SUCCESS` \| `DENIED` \| `FAILED` | Resultado (401/403/429 = DENIED) |
| `actorUuid/Email/Role` | NULL | Quién (NULL si no había sesión) |
| `ip`, `userAgent`, `requestId` | | Contexto; `requestId` = `X-Request-Id` |
| `changedFields` | `text[]` | Nombres de campos del body |

## Errores

| Código | HTTP | Cuándo |
|---|---|---|
| `SAUT-E001` | 403 | No es ADMIN |
| `SAUD-E001` | 404 | Entrada inexistente |
