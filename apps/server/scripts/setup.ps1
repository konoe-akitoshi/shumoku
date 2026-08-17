# Shumoku Server Setup Script (Windows)
# Usage: .\scripts\setup.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Split-Path -Parent $ScriptDir
$RootDir = Split-Path -Parent (Split-Path -Parent $ServerDir)

Write-Host "=== Shumoku Server Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check for bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Error: bun is not installed." -ForegroundColor Red
    Write-Host "Install it from: https://bun.sh"
    exit 1
}

Write-Host "[1/2] Installing dependencies..." -ForegroundColor Yellow
Set-Location $RootDir
bun install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "[2/2] Building server (API + Web UI and their dependencies)..." -ForegroundColor Yellow
bun x turbo run build --filter=@shumoku/server-api --filter=@shumoku/server-web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:"
Write-Host "  bun run dev:server    # Development mode (API + Web UI)"
Write-Host "  cd apps/server && bun run start    # Production mode"
Write-Host ""
Write-Host "Development: http://localhost:5173"
Write-Host "Production:  http://localhost:8080"
