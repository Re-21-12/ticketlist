# Colección de Postman — Ticketit API

Colección **generada** desde el OpenAPI de la API (69 rutas, 86 operaciones) más una carpeta a mano, «00 · Prueba de humo», con aserciones.

| Archivo | Para qué |
| --- | --- |
| `ticketit.postman_collection.json` | La colección (importar en Postman). |
| `environments/local.postman_environment.json` | `http://localhost:3000` con las cuentas de **demostración** (`SEED_DEMO_DATA`). |
| `environments/produccion.postman_environment.json` | `https://tickets.glumi.lat` (entorno de pruebas del proyecto). |
| `environments/tailnet.postman_environment.json` | `https://ticketit-db.tail2a34b8.ts.net` (API por Tailscale Serve, si se activa). |

## Uso en Postman

1. **Import** → la colección y los tres entornos de `environments/`.
2. Elige el entorno arriba a la derecha y rellena `email` y `password` (la clave es tipo *secret*: no se sincroniza ni se exporta).
   Usa una cuenta de **Cliente** (VIEWER): crea y comenta sus propios tickets, que es lo que hace el flujo de humo.
3. Corre la carpeta **00 · Prueba de humo** (*Run folder*) o cualquier endpoint suelto: la sesión es la cookie `sid` y Postman la guarda en su *cookie jar*.

### Cómo se maneja el token CSRF

Toda petición que modifica (`POST`, `PATCH`, `PUT`, `DELETE`) debe llevar `X-XSRF-TOKEN` igual a la cookie `XSRF-TOKEN` (si no: 403 `SAUT-E003`).
El guion *pre-request* de la colección lo agrega solo; el guion *test* guarda el valor vigente en la variable `xsrfToken` tras cada respuesta.
No hay que tocar nada. Si cierras sesión y entras con otra cuenta, el siguiente login lo renueva.

### Variables de la colección

Los ids de las rutas (`{{ticketUuid}}`, `{{userUuid}}`, `{{catalogKey}}`…) son variables de la colección: la prueba de humo llena `ticketUuid`; las demás se completan a mano o desde el resultado de un `GET`.

## Desde la consola (newman)

```bash
npx newman run docs/postman/ticketit.postman_collection.json \
  -e docs/postman/environments/local.postman_environment.json \
  --folder "00 · Prueba de humo"

# Contra el entorno de pruebas (la clave sale de una variable, no del archivo):
npx newman run docs/postman/ticketit.postman_collection.json \
  -e docs/postman/environments/produccion.postman_environment.json \
  --env-var email=cliente@ejemplo.com --env-var password="$QA_PASSWORD" \
  --folder "00 · Prueba de humo"
```

Sale con código distinto de 0 si falla alguna aserción, así que sirve en CI.

## Qué comprueba la prueba de humo

Salud → iniciar sesión (cookies `sid` y `XSRF-TOKEN`) → shell → crear ticket → leerlo → comentar → historial → ruta inexistente (404 `NEST-E404` **sin** `detail` ni trazas) → escritura con token falso (403 `SAUT-E003`) → cerrar sesión → ya sin sesión (401).

## Regenerar tras cambiar un endpoint

El OpenAPI sale de los schemas Zod, así que basta volver a generar con la API corriendo:

```bash
cd ticketlistbe && bun run start:dev        # otra terminal
bun run docs:postman                        # lee http://localhost:3000/api/openapi.json
# o desde el entorno de pruebas:
node scripts/generate-postman.mjs --url https://tickets.glumi.lat/api/openapi.json
```

Los entornos y la carpeta de humo los escribe el propio script (`ticketlistbe/scripts/generate-postman.mjs`); no se editan a mano.

## Seguridad

- Las claves de las cuentas **no** se guardan en los entornos (excepto las de demostración del entorno `local`, que son públicas en `users.seed.ts`).
- Los endpoints de administración (`Users · Administración`, `Role permissions`, `Tareas programadas`…) piden una cuenta con ese rol: con la de Cliente responden 403, y eso es lo esperado.
