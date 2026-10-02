#!/bin/sh
# ────────────────────────────────────────────────────────────────────────────────────────────────
# Entrypoint del contenedor api.
#
# Docker secrets: por cada VARIABLE_FILE=/ruta definida, si la variable VARIABLE no viene ya en el
# entorno se exporta con el contenido del archivo (sin salto de línea final). Así los secretos
# (SESSION_SECRET, TOTP_ENCRYPTION_KEY, SEED_USERS_JSON, BOOTSTRAP_ADMIN_PASSWORD…) pueden ir como `secrets:` de
# Compose en vez de variables visibles en `docker inspect`.
# ────────────────────────────────────────────────────────────────────────────────────────────────
set -e

for name in SESSION_SECRET TOTP_ENCRYPTION_KEY BOOTSTRAP_ADMIN_PASSWORD SEED_USERS_JSON DATABASE_URL REDIS_URL; do
  file_var="${name}_FILE"
  file_path="$(printenv "$file_var" || true)"
  if [ -n "$file_path" ] && [ -z "$(printenv "$name" || true)" ]; then
    if [ ! -r "$file_path" ]; then
      echo "✗ $file_var apunta a $file_path y no se puede leer" >&2
      exit 1
    fi
    value="$(cat "$file_path")"
    export "$name=$value"
  fi
done

exec "$@"
