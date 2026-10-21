# syntax=docker/dockerfile:1

# ---- Build: Node runs Astro, Bun installs deps from bun.lock --------------
FROM node:24.22.0-bookworm-slim AS build
# ponytail: 24.22.1 (Oct 2026 security release) has no Docker image yet, so swap in
# the official binary, checksum from nodejs.org SHASUMS256.txt. amd64 only, like CI.
# Drop this and use node:24.22.1-bookworm-slim once that tag has images.
ADD --checksum=sha256:eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c \
	https://nodejs.org/dist/v24.22.1/node-v24.22.1-linux-x64.tar.gz /tmp/node.tar.gz
RUN tar -xzf /tmp/node.tar.gz -C /usr/local/bin --strip-components=2 node-v24.22.1-linux-x64/bin/node \
	&& rm /tmp/node.tar.gz && node -v | grep -qx v24.22.1
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
