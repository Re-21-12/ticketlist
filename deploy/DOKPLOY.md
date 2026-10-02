# Ticketit en Dokploy

Dos formas de desplegar. La **A (stack propio)** es la recomendada; la **B** mete Ticketit en el compose de wallet-api para compartir su Redis y su Postgres.

| | A · Stack propio | B · Dentro del compose de wallet-api |
|---|---|---|
| Archivo | `docker-compose.dokploy.yml` | `docker-compose.wallet-integration.yml` |
| Servicios | web, api, **db**, **redis** | web, api, `ticketit-db-init` (usa el `db` y el `redis` de wallet) |
| Aislamiento | total (si uno cae, el otro no) | Redis con prefijo `ticketit:`; Postgres con su propia base y rol |
| Cuándo | por defecto | si el VPS es chico y quieres un solo Postgres/Redis |

Las dos usan **la misma imagen** y el mismo patrón que wallet-api: Traefik de Dokploy en el borde, `dokploy-network` externa, secretos en archivos y rutas relativas `../files/`.

## 1. Imágenes (GHCR)

Mismo flujo que wallet-api. Dos workflows en `.github/workflows/`:

- **`ci.yml`** (push a `main`/`develop` y pull requests): lint, pruebas y build de lo que cambió, más una construcción de prueba de las imágenes.
- **`docker-publish.yml`**: en cada push publica a `ghcr.io/re-21-12/ticketlist/{api,web}` **solo la imagen afectada** (por rutas: `ticketlistbe/**` → api, `ticketkanban/**` → web, el Caddyfile incluido) con dos etiquetas:

| Rama | Etiqueta de rama | Etiqueta inmutable |
|---|---|---|
| `main` | `latest` | `sha-<7 caracteres>` |
| `develop` | `dev` | `sha-<7 caracteres>` |
| `release/1.2` | `release-1.2` | `sha-<7 caracteres>` |
| `feature/x`, `hotfix/y` | `feature-x`, `hotfix-y` | `sha-<7 caracteres>` |

`workflow_dispatch` (botón «Run workflow») reconstruye las dos. Usan `GITHUB_TOKEN` (sin secretos extra) y caché de buildx en GitHub Actions.

Usar una etiqueta en Dokploy: `WEB_IMAGE_TAG` / `API_IMAGE_TAG` (o `TICKETIT_IMAGE_TAG`) = `latest`, `dev` o `sha-abc1234`.

Si los paquetes son **privados**, el VPS necesita `docker login ghcr.io` (el mismo login que ya usa Dokploy para wallet-api); la primera vez, en GitHub → *Packages* enlaza cada paquete al repositorio o dale permiso de lectura.

Probar las imágenes a mano:

```bash
docker build -t ticketit-api ticketlistbe
docker build -t ticketit-web ticketkanban
```

## 2. Antes de nada: qué cambia en producción

- **No hay usuarios de prueba.** `NODE_ENV=production` desactiva los datos de demostración (los usuarios `*@ticketit.dev` con la contraseña pública `ticketit-dev` y los tickets de ejemplo). Las cuentas iniciales salen del secreto `ticketit_seed_users`: **una por rol** (ADMIN, SUPERVISOR, AGENT, AUDITOR, VIEWER), cada una con su contraseña aleatoria. Los permisos por rol, el menú y los catálogos (tipos, urgencias, departamentos…) ya vienen sembrados en el código. Si `SEED_DEMO_DATA=false` y no hay ningún ADMIN en ese secreto, **la API no arranca** (a propósito).
- **Arranque seguro:** en `production` la API exige también `SESSION_SECRET` y `TOTP_ENCRYPTION_KEY` propios (≥ 32 caracteres) y `REDIS_URL`.
- **Persistencia (TypeORM + Postgres):** todo el dominio (usuarios, tickets con historial y adjuntos, catálogos, permisos, notificaciones, relaciones) se guarda en Postgres y **sobrevive a reinicios y redeploys**. Las migraciones corren **solas al arrancar** la API (`DB_AUTO_MIGRATE=true`); las semillas son idempotentes (no pisan lo que un administrador editó ni las contraseñas que cambió cada persona). Modelo y límites en `ticketlistbe/docs/standard/persistence.md`: la API corre en **una sola instancia** (no la escales a varias réplicas todavía).
- **Sin confirmación por correo:** el registro público deja la cuenta **activa al instante** (siempre con el rol de menor privilegio, VIEWER); no hay SMTP ni enlaces de verificación. La recuperación de contraseña funciona **sin correo** con el código del autenticador (TOTP) o con la contraseña actual. El enlace «por correo» de `/forgot-password` no llega a nadie mientras no exista un adaptador SMTP: por eso conviene que cada persona active su autenticador en Mi perfil → Seguridad, y que el administrador conserve el acceso.

## 3. Secretos y variables (común a A y B)

Genera los tres secretos con el script (mismo patrón que `generate-secrets.mjs` de wallet-api; solo requiere Node):

```bash
node deploy/generate-secrets.mjs --env
```

- Crea `deploy/secrets/` (gitignored) con `ticketit_session_secret`, `ticketit_totp_encryption_key` y `ticketit_seed_users` (JSON con las cuentas por rol), y **imprime una sola vez** correo y clave de cada cuenta.
- `--domain empresa.com` define los correos: `admin@`, `supervisor@`, `soporte@`, `auditor@` y `cliente@` ese dominio (por defecto `ticketit.local`).
- `--env` además imprime `DB_PASSWORD`, `REDIS_PASSWORD` y `TICKETIT_DB_PASSWORD` nuevos para la pestaña *Environment*.
- Nunca pisa un archivo existente (si regeneras la clave TOTP, los autenticadores ya configurados dejan de servir); `--force` lo regenera todo.

Cópialos al VPS, junto al compose de Dokploy (la carpeta `files/` es la que se conserva entre redeploys):

```bash
scp -r deploy/secrets/* root@TU_VPS:/etc/dokploy/compose/<proyecto>/files/secrets/
ssh root@TU_VPS 'chown 1000:1000 /etc/dokploy/compose/<proyecto>/files/secrets/* && chmod 400 /etc/dokploy/compose/<proyecto>/files/secrets/*'
```

> **Dueño `1000:1000` (no root):** la API corre como el usuario `node` (uid 1000) y un secreto de archivo se monta con el dueño y permisos del host. Con `root:root` y `600` el contenedor responde «SESSION_SECRET_FILE … no se puede leer» y no arranca.

> Respalda `ticketit_totp_encryption_key` por separado.

Variables en la pestaña **Environment** del compose (plantilla en `.env.example`): `TICKETIT_DOMAIN`, `DB_PASSWORD`, `REDIS_PASSWORD`, etc. Nada secreto va en el repo.

## 4-A. Stack propio (recomendado)

1. En Dokploy: **Project → Create Service → Compose → Raw**, pega `docker-compose.dokploy.yml`.
2. Pestaña **Environment**: copia `.env.example` y ajusta `TICKETIT_DOMAIN`, `DB_PASSWORD`, `REDIS_PASSWORD`.
3. Crea los secretos (§3).
4. DNS: un registro `A` de `TICKETIT_DOMAIN` hacia el VPS.
5. **Deploy**. Traefik emite el certificado (Let's Encrypt) y enruta: `/api/*` → api, el resto → web.

Verificación:

```bash
curl -s https://tickets.tudominio.com/api/health/ready      # {"status":"ok",...}
curl -sI https://tickets.tudominio.com/ | grep -i content-security-policy
```

Entra con `admin@<dominio>` y su clave; **cámbiala en Mi perfil → Seguridad** y configura el autenticador. Cada rol puede entrar con su cuenta (`supervisor@`, `soporte@`, `auditor@`, `cliente@`).

## 4-B. Integrado en el compose de wallet-api

1. En el compose de wallet-api (`docker/docker-compose.dokploy.yml`), agrega bajo `services:` los servicios `ticketit-db-init`, `ticketit-web` y `ticketit-api` de `docker-compose.wallet-integration.yml`, y los tres `secrets:` nuevos al final. (O ejecuta ambos archivos juntos con `-f`.)
2. Variables nuevas en Environment (las de wallet siguen igual): `TICKETIT_DOMAIN`, `TICKETIT_DB_PASSWORD`, `TICKETIT_IMAGE_TAG`.
3. Crea los 3 secretos de Ticketit (§3) junto a los de wallet.
4. **Deploy.** `ticketit-db-init` crea una vez (idempotente) el rol `ticketit_app` y la base `ticketit` en el Postgres de wallet-api —sin tocar `wallet_prod` ni sus roles— y la API arranca después. Reusa el `redis` de wallet con prefijo `ticketit:`.

Detalles que ya están resueltos (los mismos problemas que encontraste en wallet-api):

- Los routers/servicios de Traefik se llaman `ticketit-spa` / `ticketit-api` para **no chocar** con los `spa`/`api` de wallet en el mismo Traefik; el middleware de HSTS también es propio (`ticketit-headers`).
- `traefik.docker.network=dokploy-network` en la API (está en dos redes).
- Sin `ports:`, rutas de secretos relativas a `../files/`, `read_only` + `cap_drop: ALL`.

## 5. Probar todo en local (sin Dokploy)

```bash
cd deploy
docker network create dokploy-network
node generate-secrets.mjs      # crea deploy/secrets/ y muestra las cuentas por rol
printf 'TICKETIT_DOMAIN=localhost\nDB_PASSWORD=db-local\nREDIS_PASSWORD=redis-local\nBOOTSTRAP_ADMIN_EMAIL=admin@local.test\n' > .env.local
docker compose -f docker-compose.dokploy.yml -f docker-compose.local-test.yml --env-file .env.local up --build
# web → http://localhost:8080   api → http://localhost:3001/api/health
```

En local la API corre en `production` sin HTTPS, así que la cookie de sesión (`Secure`) no se guarda desde el navegador: sirve para probar arranque, salud y migración, no para iniciar sesión por `http`. Para eso, usa el dominio real detrás de Traefik.

## 6. Actualizar y revertir

- Actualizar: cada push a `main` publica `:latest` y `:sha-<7>`; **Watchtower ya viene en `docker-compose.dokploy.yml`** (`nickfedor/watchtower`, `--label-enable`, cada 5 min): recrea `web`/`api` cuando cambia el digest de `:latest`, sin tocar db, redis ni el stack de Dokploy. Si wallet-api ya corre su propio Watchtower en el mismo VPS, **quita el servicio `watchtower` de este compose**: el de wallet-api vigila todo el host por label y dos se pisan. Sin Watchtower, usa **Redeploy** en Dokploy.
- Revertir: pon `WEB_IMAGE_TAG` / `API_IMAGE_TAG` (o `TICKETIT_IMAGE_TAG`) al `sha-<7>` anterior y redeploy.

## 7. Checklist de producción

- [ ] Los 3 secretos creados, con permisos `600`, y la clave TOTP respaldada aparte.
- [ ] `SEED_DEMO_DATA=false` (no existen cuentas con clave pública).
- [ ] `API_DOCS_ENABLED=false` (sin Scalar/OpenAPI público).
- [ ] DNS y certificado emitido; `/api/health/ready` responde `ok`.
- [ ] Contraseña del administrador cambiada y autenticador (TOTP) activado.
- [ ] Respaldo programado del volumen de Postgres (`ticketit-postgres`, o la base `ticketit` en la integración con wallet): ahora ahí vive todo.
- [ ] Una sola réplica de `api` (ver §2).
