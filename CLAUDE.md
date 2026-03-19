# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shumoku is a modern network topology visualization library for Markdown. It enables network engineers to create interactive network diagrams directly in documentation. The project is a TypeScript monorepo using bun workspaces and Turborepo.

## Commands

### Development
```bash
bun install           # Install all dependencies
bun run build         # Build all packages (respects dependency order)
bun run dev           # Run all packages in dev mode
bun run typecheck     # Type check all packages
bun run lint          # Lint all packages
bun run format        # Format with Biome
bun run test          # Run tests across packages
```

### Package-specific
```bash
# Run docs dev server (includes playground)
cd apps/docs && bun run dev

# Run tests for core package only
cd libs/@shumoku/core && bun run test

# Watch mode for core development
cd libs/@shumoku/core && bun run dev
```

## Architecture

### Monorepo Structure
```
libs/
  @shumoku/core              ← models, layout, themes, parser, plugin-types, fixtures, icons
  @shumoku/renderer-svg      ← SVG renderer, pipeline, CDN icons
  @shumoku/renderer-png      ← PNG renderer (depends on renderer-svg, @resvg/resvg-js)
  @shumoku/renderer-html     ← HTML renderer (depends on renderer-svg)
  shumoku                    ← Main wrapper (re-exports core + renderer-svg + renderer-html)
  plugins/
    grafana/                 ← Grafana plugin (alerts)
    netbox/                  ← NetBox plugin (topology, hosts)
    prometheus/              ← Prometheus plugin (metrics, hosts, alerts)
    zabbix/                  ← Zabbix plugin (metrics, hosts, auto-mapping, alerts)

apps/
  cli/     ← CLI tool (shumoku render)
  docs/    ← Documentation site with playground (Next.js)
  server/  ← Real-time visualization server
```

### Core Library (`@shumoku/core`)

**Models** (`src/models/`): Data structures for network topology
- `Node` - Network devices with type, vendor, model
- `Link` - Connections between nodes with bandwidth, VLAN
- `Subgraph` - Logical groupings with nested structure
- `NetworkGraph` - Root container for the entire network definition

**Parser** (`src/parser/`): YAML parser for network definitions
- `YamlParser` - Single-file YAML parser
- `HierarchicalParser` - Multi-file parser with `file:` references
- Device:port notation, type aliases, bandwidth normalization

**Layout Engines** (`src/layout/`): Automatic positioning algorithms
- `HierarchicalLayout` - ELK-based hierarchical layout
- Produces `LayoutResult` with positioned nodes, links, subgraphs

**Plugin Types** (`src/plugin-types.ts`): All capability interfaces
- `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`
- `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`
- `MetricsData`, `MetricsMapping`, `Alert`, `AlertSeverity`

**Themes** (`src/themes/`): Visual styling
- `lightTheme`, `darkTheme` presets
- `createTheme()`, `mergeTheme()` utilities

### Renderer SVG (`@shumoku/renderer-svg`)

**Pipeline API** (`src/pipeline.ts`): Unified render pipeline
- `prepareRender()` - Resolve icon dimensions and compute layout
- `renderSvg()` - Render to SVG from prepared data
- `renderEmbeddable()` - Render for embedding in web apps

**CDN Icons** (`src/cdn-icons.ts`): Icon dimension resolution

### Renderer PNG (`@shumoku/renderer-png`)

- `renderPng()` - Render to PNG from prepared data (Node.js only, requires @resvg/resvg-js)
- `renderGraphToPng()` - Convenience one-liner
- Depends on renderer-svg for SVG generation

### Renderer HTML (`@shumoku/renderer-html`)

- `render()` - Interactive HTML with pan/zoom, tooltips
- `renderHierarchical()` - Multi-sheet navigation
- `renderHtml()`, `renderHtmlHierarchical()` - Pipeline convenience wrappers
- IIFE bundle for interactive features

### Plugins (`libs/plugins/`)

Plugins implement `DataSourcePlugin` from `@shumoku/core` and depend only on core.
- **grafana**: Alerts via Alertmanager API or webhook
- **netbox**: Topology and hosts from NetBox DCIM/IPAM
- **prometheus**: Metrics, hosts, alerts from Prometheus/Alertmanager
- **zabbix**: Metrics, hosts, auto-mapping, alerts from Zabbix

### Data Flow
```
YAML input → YamlParser.parse() → NetworkGraph → prepareRender() → PreparedRender → renderSvg/Html/Png() → Output
```

Pipeline internally handles:
1. Icon dimension resolution (CDN fetch with caching)
2. Layout computation (HierarchicalLayout)
3. Rendering with proper icon aspect ratios

## Versioning

- 0.x の間は基本 **patch** を使う
- **minor** は大きな新機能追加・新しい公開API追加時のみ
- **major** は 1.0.0 リリース時または破壊的変更時
- 迷ったら patch

## Code Style

- Biome for formatting and linting
- Single quotes, no semicolons, trailing commas
- 100 character line width
- ESM modules (`"type": "module"`)

## Key Types

```typescript
// Creating a network programmatically
const graph: NetworkGraph = {
  name: 'My Network',
  nodes: Node[],
  links: Link[],
  subgraphs?: Subgraph[],
  settings?: NetworkSettings
}

// Recommended: Use pipeline API (handles icon dimensions automatically)
import { prepareRender, renderSvg } from '@shumoku/renderer-svg'
import { renderHtml } from '@shumoku/renderer-html'

const prepared = await prepareRender(graph)
const svgOutput = await renderSvg(prepared)
const htmlOutput = renderHtml(prepared)

// Or use convenience functions
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToHtml } from '@shumoku/renderer-html'

const svg = await renderGraphToSvg(graph)
const html = await renderGraphToHtml(graph)
```

## Testing

Tests use the shared `sampleNetwork` fixture from `@shumoku/core`:

```typescript
import { sampleNetwork } from '@shumoku/core'
// Multi-file sample: main.yaml, cloud.yaml, perimeter.yaml, dmz.yaml, campus.yaml
```
