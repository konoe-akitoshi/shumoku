#!/bin/sh
# Shumoku Server - one-command installer
#
# Stands up the Shumoku server on a fresh Linux host using Docker Compose and
# the published container image. Installs Docker if it is missing, drops a
# compose.yaml + .env into an install directory, and starts the service.
#
# Usage (non-interactive, safe to pipe):
#   curl -fsSL https://raw.githubusercontent.com/konoe-akitoshi/shumoku/main/apps/server/scripts/install.sh | sh
#
# Configure via environment variables:
#   SHUMOKU_VERSION   image tag to run           (default: latest)
#   SHUMOKU_PORT      host port to publish        (default: 8080)
#   DEMO_MODE         seed sample network         (default: false)
#   INSTALL_DIR       where to place compose files (default: ./shumoku)
#   SHUMOKU_REF       git ref to fetch compose.yaml from (default: main)
#
# Example:
#   curl -fsSL .../install.sh | SHUMOKU_VERSION=0.1.4 SHUMOKU_PORT=80 sh

set -eu

SHUMOKU_VERSION="${SHUMOKU_VERSION:-latest}"
SHUMOKU_PORT="${SHUMOKU_PORT:-8080}"
DEMO_MODE="${DEMO_MODE:-false}"
INSTALL_DIR="${INSTALL_DIR:-./shumoku}"
SHUMOKU_REF="${SHUMOKU_REF:-main}"
COMPOSE_URL="https://raw.githubusercontent.com/konoe-akitoshi/shumoku/${SHUMOKU_REF}/apps/server/compose.yaml"

log() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$1" >&2; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# Pick a privilege escalator only when we are not already root.
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  SUDO=""
  warn "Not running as root and sudo not found; Docker install may fail."
fi

[ "$(uname -s)" = "Linux" ] || die "This installer supports Linux hosts only. On macOS/Windows use Docker Desktop and run 'docker compose up -d' with apps/server/compose.yaml."

fetch() {
  # fetch <url> <dest>
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$2" "$1"
  else
    die "Neither curl nor wget is available to download files."
  fi
}

# 1. Ensure Docker Engine + compose plugin.
if ! command -v docker >/dev/null 2>&1; then
  log "Docker not found — installing via get.docker.com"
  fetch "https://get.docker.com" /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  $SUDO systemctl enable --now docker 2>/dev/null || true
else
  log "Docker already installed: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  die "The Docker Compose plugin is unavailable. Install it, then re-run this script."
fi

# Use sudo for docker if the current user cannot reach the daemon (fresh
# installs leave the invoking user outside the docker group until re-login).
if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="$SUDO docker"
fi

# 2. Materialize the install directory with compose.yaml + .env.
log "Preparing install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
fetch "$COMPOSE_URL" "$INSTALL_DIR/compose.yaml"

cat > "$INSTALL_DIR/.env" <<EOF
SHUMOKU_VERSION=$SHUMOKU_VERSION
SHUMOKU_PORT=$SHUMOKU_PORT
DEMO_MODE=$DEMO_MODE
EOF

# 3. Pull and start.
log "Pulling image ghcr.io/konoe-akitoshi/shumoku:$SHUMOKU_VERSION"
( cd "$INSTALL_DIR" && $DOCKER compose pull )
log "Starting Shumoku server on host port $SHUMOKU_PORT"
( cd "$INSTALL_DIR" && $DOCKER compose up -d )

# 4. Wait for the container to report healthy.
log "Waiting for health check..."
i=0
while [ "$i" -lt 30 ]; do
  status="$($DOCKER inspect --format '{{.State.Health.Status}}' shumoku 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  i=$((i + 1))
  sleep 2
done

if [ "${status:-}" = "healthy" ]; then
  log "Shumoku is up and healthy."
else
  warn "Container did not report healthy in time; check: $DOCKER compose -f $INSTALL_DIR/compose.yaml logs"
fi

printf '\n'
log "Web UI:  http://<this-host>:$SHUMOKU_PORT"
log "Manage:  cd $INSTALL_DIR && $DOCKER compose {ps,logs -f,restart,down}"
log "Upgrade: edit SHUMOKU_VERSION in $INSTALL_DIR/.env, then '$DOCKER compose pull && $DOCKER compose up -d'"
