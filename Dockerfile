# syntax=docker/dockerfile:1

# ---- Build: Node runs Astro, Bun installs deps from bun.lock --------------
FROM node:24-bookworm-slim AS build
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Deps first so this layer is cached until package.json / bun.lock / patches change
COPY package.json bun.lock ./
COPY patches ./patches
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Caddy binary without its file capability -----------------------------
# The official binary carries cap_net_bind_service, which makes exec fail with
# "operation not permitted" under --cap-drop ALL. Caddy listens on unprivileged
# 8080, so strip it here (COPY --from would otherwise carry the xattr across).
FROM caddy:2.11.7-alpine AS caddy
RUN apk add --no-cache libcap && setcap -r /usr/bin/caddy

# ---- Runtime: static files + Caddy, nothing else ---------------------------
FROM alpine:3.24

COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
RUN addgroup -S caddy && adduser -S -D -H -G caddy caddy

COPY docker/Caddyfile /etc/caddy/Caddyfile

# Site files are owned by root and read-only; caddy (non-root) can only read them
COPY --from=build --chown=root:root --chmod=a=rX,u+w /app/dist /srv/www

# Caddy keeps its runtime state under XDG dirs; point them at the only writable path
ENV XDG_CONFIG_HOME=/tmp/config XDG_DATA_HOME=/tmp/data
USER caddy
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
