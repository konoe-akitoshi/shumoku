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

# Build server
WORKDIR /app/apps/server
RUN bun run build

# Build web UI
WORKDIR /app/apps/server/web
RUN bun install && bun run build

# Bundle server into single file
WORKDIR /app/apps/server
RUN bun run esbuild.config.js

# ============================================
# Production stage - Bun runtime
# ============================================
FROM oven/bun:1-slim

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy bundled server
COPY --from=builder /app/apps/server/dist/bundle.js ./server.js

# Copy web UI build
COPY --from=builder /app/apps/server/web/build ./web/build

# Create data directory
RUN mkdir -p /data

# Environment
ENV DATA_DIR=/data
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "run", "server.js"]
