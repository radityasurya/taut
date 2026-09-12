FROM oven/bun:1-alpine AS builder

USER root
WORKDIR /app

# The Bun Alpine image does not guarantee Node/npm; install them in the throwaway
# builder so the project's pinned pnpm major is available reliably.
RUN apk add --no-cache nodejs npm \
    && npm install --global pnpm@11

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY web ./web
COPY shared ./shared
COPY vite.config.ts tsconfig.json ./
RUN pnpm build

FROM oven/bun:1-alpine AS runtime

USER root
RUN apk add --no-cache openssh-client tmux git curl
RUN deluser bun 2>/dev/null || true
RUN delgroup bun 2>/dev/null || true
RUN addgroup -g 1000 tautan \
    && adduser -D -u 1000 -G tautan -h /home/tautan tautan \
    && mkdir -p /data/config /data/state /data/cache /data/run \
    && chown -R tautan:tautan /data /home/tautan

WORKDIR /app
COPY --chown=tautan:tautan server ./server
COPY --chown=tautan:tautan shared ./shared
COPY --from=builder --chown=tautan:tautan /app/dist/web ./dist/web
COPY --chown=tautan:tautan package.json ./

ENV XDG_CONFIG_HOME=/data/config \
    XDG_STATE_HOME=/data/state \
    XDG_CACHE_HOME=/data/cache \
    XDG_RUNTIME_DIR=/data/run \
    TAUTAN_BIND=0.0.0.0

VOLUME ["/data"]
EXPOSE 7700
HEALTHCHECK CMD curl -fsS "http://127.0.0.1:${TAUTAN_PORT:-7700}/api/state" || exit 1

USER tautan
CMD ["bun", "server/main.ts"]
