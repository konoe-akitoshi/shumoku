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

Write-Host "[1/4] Installing root dependencies..." -ForegroundColor Yellow
Set-Location $RootDir
bun install

Write-Host ""
Write-Host "[2/4] Building packages..." -ForegroundColor Yellow
bun run build

Write-Host ""
Write-Host "[3/4] Installing web UI dependencies..." -ForegroundColor Yellow
Set-Location "$ServerDir\web"
bun install

Write-Host ""
Write-Host "[4/4] Building web UI..." -ForegroundColor Yellow
bun run build

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server:"
Write-Host "  cd apps/server"
Write-Host "  bun run dev      # Development mode"
Write-Host "  bun run start    # Production mode"
Write-Host ""
Write-Host "Server will be available at: http://localhost:3000"
