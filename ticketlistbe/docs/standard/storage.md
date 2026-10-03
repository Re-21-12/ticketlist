# Evidencia de tickets y bucket de almacenamiento (CU02)

La evidencia que acompaña a un ticket (fotos de la solución, capturas, informes, hojas de cálculo, videos cortos) **vive en un bucket S3-compatible (MinIO)**, como en wallet-api. En la base solo queda la metadata (`ticket_attachments`).

Código: `src/core/storage/` (almacén) · `src/modules/tickets/attachments/` (tipos, límites, duración de video) · `TicketLifecycleController.upload/download`. Pruebas: `test/evidence-and-jobs.e2e-spec.ts`, `attachments/*.spec.ts`.

## 1. Qué se acepta

| Familia | Tipos (se detectan por la **firma del contenido**, no por el nombre ni por lo que declare el navegador) | Tope |
|---|---|---|
| Imagen | PNG, JPEG, GIF, WebP | 10 MB |
| Documento | PDF, Excel (`.xlsx` y `.xls`), CSV, texto plano | 25 MB |
| Video | MP4, MOV (QuickTime), WebM — **máximo 5 minutos** | 100 MB |

- Hasta **5 archivos** por comentario o por cambio de estado.
- **Excel**: un `.xlsx` es un zip que trae `xl/workbook.xml`; un zip cualquiera NO pasa. **CSV**: texto UTF-8 con extensión `.csv`.
- **Fotos HEIC/HEIF** (iPhone) comparten contenedor con el video pero **no se aceptan**: se rechazan con 415 (hay que exportarlas a JPEG).
- **Video ≤ 5 minutos**: la duración se lee de la **cabecera** del archivo (`mvhd`/`mehd` en MP4 y MOV; `Info/Duration` en WebM), sin decodificarlo. Si dura más → **422 `SATT-E004`**; si no se puede comprobar (cabecera ilegible o MP4 fragmentado sin duración) → **422 `SATT-E005`**: no se acepta lo que no se puede verificar. El front también lo comprueba antes de subir (mismo límite), pero el servidor es quien decide.
- Tope de **tamaño** por familia → 413 `SATT-E001`. El video lleva un tope de 100 MB (≈ 5 min a ~2,7 Mb/s) porque el archivo se lee en memoria al subirlo.

## 2. Cómo se guarda

```
POST /api/tickets/:uuid/attachments   (multipart, campo «file»)
   └─► detectMime (firma) ─► tope de tamaño de su familia ─► duración (si es video)
         └─► bucket: tickets/<ticketUuid>/<attachmentId>     (la clave la arma el SERVIDOR)
               └─► ticket_attachments: metadata (nombre, tipo, tamaño, familia, duración, objectKey)
```

- Un adjunto se **amarra a UN renglón del historial** (un comentario o un cambio de estado) al enviarlo; no se reutiliza (404 `RATT-E001`).
- **Evidencia de la solución**: al resolver (o cualquier cambio de estado) se pueden pasar `attachmentIds` en `POST /transitions`; las fotos quedan en el renglón `STATUS_CHANGED` y el solicitante las ve en su historial.
- **Descarga** (`GET /:uuid/attachments/:id`): solo si la persona puede leer el ticket; SIEMPRE `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` y el tipo detectado. Los objetos son **privados**: nada se sirve directo del bucket.
- Los adjuntos **anteriores** al bucket conservan su contenido en `content` (bytea) y se siguen sirviendo desde la base (migración aditiva `EvidenceBucketSurveyJobs1791000000000`).

## 3. Configuración

| Variable | Default | Qué hace |
|---|---|---|
| `S3_ENDPOINT` | — | Host de MinIO/S3. Sin él, la evidencia vive **en memoria** (desarrollo y pruebas). **Obligatorio en production** (junto con las dos claves). |
| `S3_PORT` | `9000` | Puerto |
| `S3_USE_SSL` | `false` | `true` si el endpoint es https |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | — | Credenciales (el entrypoint también lee `S3_ACCESS_KEY_FILE` / `S3_SECRET_KEY_FILE`) |
| `S3_BUCKET` | `ticketit-evidence` | Nombre del bucket; **la API lo crea** si no existe (idempotente) |
| `S3_REGION` | — | Opcional |

- **Desarrollo**: `docker compose up -d minio` (API `:9100`, consola `http://localhost:9101`, `ticketit` / `ticketit-dev-minio`) y exporta `S3_ENDPOINT=localhost S3_PORT=9100 S3_ACCESS_KEY=ticketit S3_SECRET_KEY=ticketit-dev-minio`.
- **Producción (Dokploy)**: servicio `minio` en `deploy/docker-compose.dokploy.yml` (red `backend`, **sin puerto al host**, volumen `ticketit-minio`); credenciales por `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` de la pestaña *Environment*. En la integración con wallet-api se reutiliza **su** MinIO con un bucket propio.
- **Salud**: `GET /api/health/ready` muestra `storage: up | down` cuando hay bucket real; con el bucket caído **no se quita tráfico** (solo fallan las subidas con 503 `SATT-E006`).

## 4. Límites y respaldo

- **Respalda el volumen de MinIO** (`ticketit-minio`) junto con el de Postgres: la metadata sin el objeto deja adjuntos rotos (404 al descargar).
- No hay antivirus ni miniaturas generadas en el servidor; la verificación es por firma, tamaño y (video) duración.
- Subida en una sola petición (sin reanudación). Para videos cercanos al tope conviene una conexión estable.
- Cuotas por ticket o por persona: no hay (solo el máximo de 5 por comentario).
