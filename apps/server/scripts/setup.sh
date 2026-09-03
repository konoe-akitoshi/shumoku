#!/bin/bash
# Shumoku Server Setup Script
# Usage: ./scripts/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$SERVER_DIR")")"

echo "=== Shumoku Server Setup ==="
echo ""

# Check for bun
if ! command -v bun &> /dev/null; then
    echo "Error: bun is not installed."
    echo "Install it from: https://bun.sh"
    exit 1
fi

echo "[1/2] Installing dependencies..."
cd "$ROOT_DIR"
bun install

echo ""
echo "[2/2] Building server (API + Web UI and their dependencies)..."
bun x turbo run build --filter=@shumoku/server-api --filter=@shumoku/server-web

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the server:"
echo "  bun run dev:server    # Development mode (API + Web UI)"
echo "  cd apps/server && bun run start    # Production mode"
echo ""
echo "Development: http://localhost:5173"
echo "Production:  http://localhost:8080"
