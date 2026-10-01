# Caché HTTP (RFC 9111) + ETag y concurrencia optimista (RFC 9110 §8.8.3, §13)

> Port de `wallet-api/docs/standard/http-caching.md` y `http-etag.md`, con las diferencias
> marcadas. Código: `src/core/interceptors/http-cache.interceptor.ts`, `src/core/utils/etag.util.ts`,
> `BaseService.assertIfMatch`. Tests: `test/app.e2e-spec.ts` → «Caché y concurrencia».

## Política

| Respuesta | `Cache-Control` | Otros headers | Por qué |
|---|---|---|---|
| GET/HEAD exitoso | `private, max-age=<@CacheTtl o 0>` | `ETag`, `Vary: Cookie, Accept-Language` | `private`: depende de la sesión (permisos, filas visibles), un caché compartido nunca debe reusarla. `max-age=0`: se guarda pero siempre se revalida |
| GET con `If-None-Match` coincidente | (igual) | — | **304** sin body (ahorra ancho de banda) |
| POST/PATCH/PUT/DELETE | `no-store` | — | una escritura nunca se cachea |
| Cualquier error (Problem Details) | `no-store` | `Vary: Accept-Language` | un error nunca se cachea |

`@CacheTtl(segundos)` solo va en datos que cambian poco y **no** dependen de permisos que puedan
cambiar durante la sesión. Hoy ningún endpoint lo usa.

## ETag

- **Fuerte y opaco:** `"<sha256 base64url de la representación JSON>"`. El cliente no lo interpreta, solo lo devuelve.
- **Diferencia con wallet-api:** allá es `sha256(uuid:updatedAt)`, que solo sirve para ítems. Aquí se hashea la representación, así también cubre listados y respuestas del BFF.
- `etagMatches()` acepta listas separadas por coma, `*` y el prefijo débil `W/` (comparación débil de §8.8.3.2 para `If-None-Match`).

## Concurrencia optimista (`If-Match` → 412)

1. El front hace `GET /api/tickets/:uuid` y recibe `ETag: "abc"`.
2. Envía `PATCH` con `If-Match: "abc"`.
3. `BaseService.assertIfMatch` recalcula el ETag de la representación **actual**. Si otra persona la cambió, responde **412 `SCONC-E001`** con `context.uuid`: la «actualización perdida» se detecta en vez de pisarse.
4. Sin `If-Match` no se valida (retrocompatible, igual que en wallet-api).

Aplica a PATCH y DELETE de todo recurso que extienda `BaseService`.
