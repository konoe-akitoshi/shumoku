# syntax=docker/dockerfile:1.4

# ============================================
# Build stage
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy monorepo config and required packages
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY packages/@shumoku/core/ ./packages/@shumoku/core/
COPY packages/@shumoku/parser-yaml/ ./packages/@shumoku/parser-yaml/
COPY packages/@shumoku/renderer/ ./packages/@shumoku/renderer/
COPY packages/@shumoku/netbox/ ./packages/@shumoku/netbox/
COPY apps/server/ ./apps/server/

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Build all packages (turborepo handles dependency order)
RUN bun run build

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
FROM oven/bun:1-slim

# Metadata
LABEL org.opencontainers.image.title="Shumoku"
LABEL org.opencontainers.image.description="Network topology visualization server"
LABEL org.opencontainers.image.source="https://github.com/konoe-akitoshi/shumoku"

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (use existing group if GID 1000 exists)
RUN getent group 1000 || groupadd --gid 1000 shumoku \
    && (getent passwd 1000 || useradd --uid 1000 --gid 1000 --shell /bin/sh --create-home shumoku)

# Copy bundled server
COPY --from=builder /app/apps/server/api/dist/bundle.js ./server.js

# Copy web UI build
COPY --from=builder /app/apps/server/web/build ./web/build

# Create data directory with correct ownership
RUN mkdir -p /data && chown -R 1000:1000 /data /app

# Environment
ENV DATA_DIR=/data
ENV PORT=8080
ENV HOST=0.0.0.0

# Switch to non-root user
USER 1000

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["bun", "run", "server.js"]
