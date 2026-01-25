# Shumoku Server Makefile
# Usage: make [target]

.PHONY: setup build dev start stop clean docker docker-build docker-up docker-down docker-logs help

# Default target
.DEFAULT_GOAL := help

# Directories
ROOT_DIR := ../..
WEB_DIR := web

# =============================================================================
# Setup & Build
# =============================================================================

setup: ## Initial setup (install dependencies and build)
ifeq ($(OS),Windows_NT)
	powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
else
	bash scripts/setup.sh
endif

build: ## Build all packages
	cd $(ROOT_DIR) && bun run build
	cd $(WEB_DIR) && bun run build

build-server: ## Build server only
	bun run build

build-web: ## Build web UI only
	cd $(WEB_DIR) && bun run build

# =============================================================================
# Development
# =============================================================================

dev: ## Start development server (with hot reload)
	bun run dev

dev-web: ## Start web UI dev server
	cd $(WEB_DIR) && bun run dev

start: ## Start production server
	bun run start

# =============================================================================
# Docker
# =============================================================================

docker: docker-up ## Alias for docker-up

docker-build: ## Build Docker image
	docker compose build

docker-up: ## Start with Docker Compose
	docker compose up -d

docker-down: ## Stop Docker containers
	docker compose down

docker-logs: ## View Docker logs
	docker compose logs -f

docker-clean: ## Remove Docker volumes and images
	docker compose down -v --rmi local

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts
	rm -rf dist
	rm -rf $(WEB_DIR)/build
	rm -rf $(WEB_DIR)/.svelte-kit

typecheck: ## Run type checking
	bun run typecheck
	cd $(WEB_DIR) && bun run check

lint: ## Run linter
	bun run lint

# =============================================================================
# Help
# =============================================================================

help: ## Show this help
	@echo "Shumoku Server - Available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:"
	@echo "  make setup    # First time setup"
	@echo "  make dev      # Start development server"
	@echo "  make docker   # Start with Docker"
