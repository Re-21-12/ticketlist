# syntax=docker/dockerfile:1
# ── ticketlistbe (BFF NestJS 12 · ESM) ─────────────────────────────────────────────────────────
# Build con bun (lockfile `bun.lock`), ejecución con Node 24: `nest build` deja `dist/` en ESM y
# `start:prod` es `node dist/main`. La imagen final solo lleva dependencias de producción.
ARG BUN_IMAGE=oven/bun:1-alpine
ARG NODE_IMAGE=node:24-alpine

# ── 1. Dependencias de producción ──────────────────────────────────────────────────────────────
FROM ${BUN_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production --ignore-scripts

# ── 2. Build ───────────────────────────────────────────────────────────────────────────────────
FROM ${BUN_IMAGE} AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN bun run build

# ── 3. Producción ──────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS production
ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
# Lee `*_FILE` (Docker secrets) y los pasa como variables antes de arrancar.
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main"]
