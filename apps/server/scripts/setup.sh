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

echo "[1/4] Installing root dependencies..."
cd "$ROOT_DIR"
bun install

echo ""
echo "[2/4] Building packages..."
bun run build

echo ""
echo "[3/4] Installing web UI dependencies..."
cd "$SERVER_DIR/web"
bun install

echo ""
echo "[4/4] Building web UI..."
bun run build

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the server:"
echo "  cd apps/server"
echo "  bun run dev      # Development mode"
echo "  bun run start    # Production mode"
echo ""
echo "Server will be available at: http://localhost:3000"
