# syntax=docker/dockerfile:1
# ── ticketkanban (SPA Angular 22) → Caddy ───────────────────────────────────────────────────────
# El navegador habla con el BFF por la MISMA origin (`/api`, `environment.prod.ts`): el proxy de borde
# (Traefik de Dokploy) enruta `/api` al contenedor api y todo lo demás a este. Caddy sirve el build
# estático, hace el fallback SPA y aplica los encabezados de seguridad.
ARG NODE_IMAGE=node:24-alpine
ARG CADDY_IMAGE=caddy:2-alpine

# ── 1. Build ───────────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NG_CLI_ANALYTICS=false CI=true
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY angular.json tsconfig.json tsconfig.app.json .postcssrc.json ./
COPY public ./public
COPY src ./src
# Configuración `production` (por defecto): `environment.prod.ts` → BFF real en `/api`, sin usuarios de prueba.
RUN npm run build

# Hash de cada <script> en línea del index.html (el tema se aplica antes de que Angular arranque): el CSP los
# permite por hash en vez de abrir 'unsafe-inline'. Se recalcula en cada build, así no se desfasa.
COPY docker/Caddyfile /tmp/Caddyfile
RUN node -e "\
const fs=require('fs'),c=require('crypto');\
const html=fs.readFileSync('dist/ticketkanban/browser/index.html','utf8');\
const hashes=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>\"'sha256-\"+c.createHash('sha256').update(m[1],'utf8').digest('base64')+\"'\");\
fs.writeFileSync('/tmp/Caddyfile',fs.readFileSync('/tmp/Caddyfile','utf8').replace('__INLINE_SCRIPT_HASHES__',hashes.join(' ')));"

# ── 2. Producción ──────────────────────────────────────────────────────────────────────────────
FROM ${CADDY_IMAGE} AS production
RUN addgroup -S nonroot && adduser -S nonroot -G nonroot && \
    mkdir -p /data/caddy /config/caddy && chown -R nonroot:nonroot /data /config
COPY --from=builder /tmp/Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist/ticketkanban/browser/ /srv/
USER nonroot
EXPOSE 80
