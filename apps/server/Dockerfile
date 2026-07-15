# syntax=docker/dockerfile:1.4

# ============================================
# Build stage
# ============================================
FROM oven/bun:1.3.4 AS builder

ARG SHUMOKU_VERSION=dev
ARG SHUMOKU_COMMIT=unknown
ARG SHUMOKU_BUILD_DATE=unknown
ARG SHUMOKU_CHANNEL=development
ENV SHUMOKU_VERSION=$SHUMOKU_VERSION
ENV SHUMOKU_COMMIT=$SHUMOKU_COMMIT
ENV SHUMOKU_BUILD_DATE=$SHUMOKU_BUILD_DATE
ENV SHUMOKU_CHANNEL=$SHUMOKU_CHANNEL

WORKDIR /app

# --- Dependency layer -------------------------------------------------------
# Copy ONLY manifests first so `bun install` caches independently of source
# edits: a code-only change no longer busts the install layer. Keep this list in
# sync with the source COPY below — a new workspace needs its package.json added
# here for bun to resolve the workspace graph.
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY libs/@shumoku/core/package.json ./libs/@shumoku/core/
COPY libs/@shumoku/catalog/package.json ./libs/@shumoku/catalog/
COPY libs/@shumoku/renderer/package.json ./libs/@shumoku/renderer/
COPY libs/@shumoku/renderer-svg/package.json ./libs/@shumoku/renderer-svg/
COPY libs/@shumoku/renderer-html/package.json ./libs/@shumoku/renderer-html/
COPY libs/@shumoku/plugin-sdk/package.json ./libs/@shumoku/plugin-sdk/
COPY libs/plugins/arista-cv-cue/package.json ./libs/plugins/arista-cv-cue/
COPY libs/plugins/aruba-instant-on/package.json ./libs/plugins/aruba-instant-on/
COPY libs/plugins/grafana/package.json ./libs/plugins/grafana/
COPY libs/plugins/netbox/package.json ./libs/plugins/netbox/
COPY libs/plugins/network-scan/package.json ./libs/plugins/network-scan/
COPY libs/plugins/prometheus/package.json ./libs/plugins/prometheus/
COPY libs/plugins/zabbix/package.json ./libs/plugins/zabbix/
COPY apps/server/package.json ./apps/server/
COPY apps/server/api/package.json ./apps/server/api/
COPY apps/server/web/package.json ./apps/server/web/

# --ignore-scripts: containers don't need git hooks, so skip lifecycle scripts
# (e.g. lefthook's postinstall). Avoids running JS that isn't needed for the build.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --ignore-scripts

# --- Source layer -----------------------------------------------------------
# Copied AFTER install so source-only changes reuse the cached dependency layer.
COPY assets/ ./assets/
COPY libs/@shumoku/core/ ./libs/@shumoku/core/
COPY libs/@shumoku/catalog/ ./libs/@shumoku/catalog/
COPY libs/@shumoku/renderer/ ./libs/@shumoku/renderer/
COPY libs/@shumoku/renderer-svg/ ./libs/@shumoku/renderer-svg/
COPY libs/@shumoku/renderer-html/ ./libs/@shumoku/renderer-html/
COPY libs/@shumoku/plugin-sdk/ ./libs/@shumoku/plugin-sdk/
COPY libs/plugins/ ./libs/plugins/
COPY apps/server/ ./apps/server/

# Resolve symlinks in static/ (Docker COPY may not follow cross-directory symlinks)
RUN cd apps/server/web/static && \
    for f in *; do [ -L "$f" ] && cp --remove-destination "$(readlink -f "$f")" "$f" || true; done

# Build library packages (turborepo handles dependency order). The turbo cache
# mount lets unchanged packages hit turbo's local cache across builds.
RUN --mount=type=cache,target=/app/.turbo \
    bunx turbo run build --filter=@shumoku/core --filter=@shumoku/catalog --filter=@shumoku/renderer --filter=@shumoku/renderer-svg --filter=@shumoku/renderer-html --filter=@shumoku/plugin-sdk --filter='./libs/plugins/**'

# Create workspace symlinks for server packages (bun may skip these when some workspace dirs are missing)
RUN mkdir -p /app/apps/server/node_modules/@shumoku && \
    ln -s /app/libs/@shumoku/core /app/apps/server/node_modules/@shumoku/core && \
    ln -s /app/libs/@shumoku/catalog /app/apps/server/node_modules/@shumoku/catalog && \
    ln -s /app/libs/@shumoku/renderer /app/apps/server/node_modules/@shumoku/renderer && \
    ln -s /app/libs/@shumoku/renderer-svg /app/apps/server/node_modules/@shumoku/renderer-svg && \
    ln -s /app/libs/@shumoku/renderer-html /app/apps/server/node_modules/@shumoku/renderer-html

# Build API server (tsc)
WORKDIR /app/apps/server/api
RUN bun run build

# Build web UI
WORKDIR /app/apps/server/web
RUN bun run build

# Bundle server into single file
WORKDIR /app/apps/server/api
RUN bun run esbuild.config.js

# ============================================
# Production stage - Bun runtime
# ============================================
FROM oven/bun:1.3.4-slim

ARG SHUMOKU_VERSION=dev
ARG SHUMOKU_COMMIT=unknown
ARG SHUMOKU_BUILD_DATE=unknown
ARG SHUMOKU_CHANNEL=development

# Metadata
LABEL org.opencontainers.image.title="Shumoku"
LABEL org.opencontainers.image.description="Network topology visualization server"
LABEL org.opencontainers.image.source="https://github.com/konoe-akitoshi/shumoku"
LABEL org.opencontainers.image.version=$SHUMOKU_VERSION
LABEL org.opencontainers.image.revision=$SHUMOKU_COMMIT
LABEL org.opencontainers.image.created=$SHUMOKU_BUILD_DATE

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (use existing group if GID 1000 exists)
RUN getent group 1000 || groupadd --gid 1000 shumoku \
    && (getent passwd 1000 || useradd --uid 1000 --gid 1000 --shell /bin/sh --create-home shumoku)

# Copy bundled server + the derivation Worker (spawned at runtime via
# `new Worker(url)`, so it ships as a sibling bundle, not inlined)
COPY --from=builder /app/apps/server/api/dist/bundle.js ./server.js
COPY --from=builder /app/apps/server/api/dist/derive-worker.js ./derive-worker.js

# Copy web UI build
COPY --from=builder /app/apps/server/web/build ./web/build

# Create data directory with correct ownership
RUN mkdir -p /data && chown -R 1000:1000 /data /app

# Environment
ENV DATA_DIR=/data
ENV PORT=8080
ENV HOST=0.0.0.0
ENV SHUMOKU_VERSION=$SHUMOKU_VERSION
ENV SHUMOKU_COMMIT=$SHUMOKU_COMMIT
ENV SHUMOKU_BUILD_DATE=$SHUMOKU_BUILD_DATE
ENV SHUMOKU_CHANNEL=$SHUMOKU_CHANNEL
ENV SHUMOKU_DEPLOYMENT=docker

# Switch to non-root user
USER 1000

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["bun", "run", "server.js"]
