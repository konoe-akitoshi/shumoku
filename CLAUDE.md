# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shumoku is a modern network topology visualization library for Markdown. It enables network engineers to create interactive network diagrams directly in documentation. The project is a TypeScript monorepo using pnpm workspaces and Turborepo.

## Commands

### Development
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (respects dependency order)
pnpm dev              # Run all packages in dev mode
pnpm typecheck        # Type check all packages
pnpm lint             # Lint all packages
pnpm format           # Format with Biome
pnpm test             # Run tests across packages
```

### Package-specific
```bash
# Run playground dev server
cd apps/playground && pnpm dev

# Run tests for core package only
cd packages/@shumoku/core && pnpm test

# Watch mode for core development
cd packages/@shumoku/core && pnpm dev
```

## Architecture

### Monorepo Structure
- `packages/@shumoku/core` - Core library (models, layout engines, themes, renderer interfaces)
- `packages/@shumoku/parser-yaml` - YAML parser for network definitions
- `apps/playground` - Vite + React demo application

### Core Library (`@shumoku/core`)

**Models** (`src/models/`): Data structures for network topology
- `Device` - Network devices (routers, switches, firewalls) with `DeviceType`, `DeviceRole`, `DeviceStatus` enums
- `Port` - Device interfaces with `PortType`, `PortMode`
- `Link` - Connections between devices with `LinkType`
- `Module` - Logical groupings for layout
- `Location` - Physical groupings (rooms, racks) with connectors
- `NetworkGraph` - Root container for the entire network definition

**Layout Engines** (`src/layout/`): Automatic positioning algorithms
- `LayoutEngine` interface defines `layout(graph, options) => LayoutResult`
- `layoutEngineFactory` creates engines by name ('hierarchical', 'bento', 'location-based')
- Engines produce `LayoutResult` with `nodes`, `edges`, `bounds`

**Themes** (`src/themes/`): Visual styling
- `modernTheme`, `darkTheme` presets
- `createTheme()`, `mergeTheme()` utilities

**Renderer** (`src/renderer/`): Output generation
- SVG renderer for diagram output

### YAML Parser (`@shumoku/parser-yaml`)

Converts YAML network definitions to `NetworkGraph`. Supports:
- Nested or flat structure (`network:` wrapper optional)
- Array-style links: `[source, target, bandwidth?]`
- Device:port notation: `"router1:eth0"`
- Type aliases: `switch` -> `l2-switch`, `fw` -> `firewall`

### Data Flow
```
YAML input → YamlParser.parse() → NetworkGraph → LayoutEngine.layout() → LayoutResult → Renderer → SVG/Canvas
```

## Code Style

- Biome for formatting and linting
- Single quotes, no semicolons, trailing commas
- 100 character line width
- ESM modules (`"type": "module"`)

## Key Types

```typescript
// Creating a network programmatically
const graph: NetworkGraph = {
  version: '1.0.0',
  devices: Device[],
  ports: Port[],
  links: Link[],
  modules?: Module[],
  locations?: Location[],
  settings?: NetworkSettings
}

// Using layout engine
const engine = layoutEngineFactory.create('location-based')
const result: LayoutResult = await engine.layout(graph, options)
```
