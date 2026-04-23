# syntax=docker/dockerfile:1.4

# ============================================
# Build stage
# ============================================
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy monorepo config and required packages
COPY package.json bun.lock turbo.json tsconfig.base.json ./
COPY assets/ ./assets/
COPY libs/@shumoku/core/ ./libs/@shumoku/core/
COPY libs/@shumoku/renderer/ ./libs/@shumoku/renderer/
COPY libs/@shumoku/renderer-svg/ ./libs/@shumoku/renderer-svg/
COPY libs/@shumoku/renderer-html/ ./libs/@shumoku/renderer-html/
COPY libs/plugins/ ./libs/plugins/
COPY apps/server/ ./apps/server/

# Resolve symlinks in static/ (Docker COPY may not follow cross-directory symlinks)
RUN cd apps/server/web/static && \
    for f in *; do [ -L "$f" ] && cp --remove-destination "$(readlink -f "$f")" "$f" || true; done

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Build library packages (turborepo handles dependency order)
RUN bunx turbo run build --filter=@shumoku/core --filter=@shumoku/renderer --filter=@shumoku/renderer-svg --filter=@shumoku/renderer-html --filter='./libs/plugins/**'

# Create workspace symlinks for server packages (bun may skip these when some workspace dirs are missing)
RUN mkdir -p /app/apps/server/node_modules/@shumoku && \
    ln -s /app/libs/@shumoku/core /app/apps/server/node_modules/@shumoku/core && \
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

# Copy libavoid WASM (needed at runtime for edge routing)
# bun stores packages in node_modules/.bun/ with versioned directories
COPY --from=builder /app/libs/@shumoku/core/node_modules/libavoid-js/dist/libavoid.wasm ./libavoid.wasm

# Copy web UI build
COPY --from=builder /app/apps/server/web/build ./web/build

# Create data directory with correct ownership
RUN mkdir -p /data && chown -R 1000:1000 /data /app

# Environment
ENV DATA_DIR=/data
ENV PORT=8080
ENV HOST=0.0.0.0
ENV LIBAVOID_WASM_PATH=/app/libavoid.wasm

# Switch to non-root user
USER 1000

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

CMD ["bun", "run", "server.js"]
