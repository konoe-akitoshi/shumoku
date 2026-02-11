# Shumoku — Network Topology Diagram Generator

<img src="assets/logo-symbol.svg" alt="Shumoku Logo" width="128" height="128">

**Network diagrams, as code.** Generate beautiful network topology diagrams (SVG/HTML) from YAML definitions.

Define your network infrastructure in YAML, get publication-ready diagrams automatically.

[![npm version](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/akitoshi)

**[Playground](https://shumoku.packof.me/)** | **[Documentation](https://shumoku.packof.me/docs/npm/yaml-reference)**

## Output Example

![Sample network diagram](apps/docs/public/hero-diagram.png)

## Features

- **YAML-based definitions** - Simple, readable network topology definitions
- **Automatic layout** - Hierarchical layout powered by ELK.js
- **Vendor icons** - Built-in icons for Yamaha, Aruba, AWS, Juniper (900+ icons)
- **SVG export** - High-quality vector output
- **TypeScript** - Full type safety
- **NetBox integration** - Auto-generate diagrams from NetBox

## Installation

```bash
npm install shumoku
```

This includes all core functionality plus 900+ vendor icons (Yamaha, Aruba, AWS, Juniper).

For NetBox integration (optional):

```bash
npm install @shumoku/netbox
```

## Quick Start

```typescript
import { YamlParser, HierarchicalLayoutEngine, SvgRenderer } from 'shumoku'

const yaml = `
name: "Simple Network"

nodes:
  - id: router
    label: "Core Router"
    type: router

  - id: switch
    label: "Main Switch"
    type: l2-switch

links:
  - from: { node: router }
    to: { node: switch }
    bandwidth: 10G
`

const parser = new YamlParser()
const graph = parser.parse(yaml)

const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

const renderer = new SvgRenderer()
const svg = renderer.render(layout)
```

## CLI Usage

### Render YAML/JSON to Diagram

```bash
# Install the renderer package
npm install @shumoku/renderer

# Render YAML to SVG
npx shumoku render network.yaml -o diagram.svg

# Render to interactive HTML
npx shumoku render network.yaml -f html -o diagram.html

# Also supports JSON input
npx shumoku render topology.json -o diagram.svg
```

### NetBox Integration

```bash
# Install the NetBox package
npm install @shumoku/netbox

# Export NetBox topology to SVG
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_TOKEN -o network.svg

# Export as JSON for further processing
npx netbox-to-shumoku -f json -o netbox.json

# Render the JSON (after merging with custom data)
npx shumoku render merged.json -o diagram.html
```

## Online Playground

Try Shumoku without installation at [shumoku.packof.me](https://shumoku.packof.me/)

## Example

```yaml
name: "Simple Network"

settings:
  direction: TB
  theme: light

subgraphs:
  - id: core
    label: "Core Layer"

nodes:
  - id: rt-01
    label: "Router 01"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: core

  - id: sw-01
    label: "Switch 01"
    type: l3-switch
    parent: core

links:
  - from:
      node: rt-01
      port: lan1
    to:
      node: sw-01
      port: ge-0/0/0
    bandwidth: 10G
```

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`shumoku`](packages/shumoku) | Main package (all-in-one) | [![npm](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku) |
| [`@shumoku/core`](packages/@shumoku/core) | Core library (models, layout) | [![npm](https://img.shields.io/npm/v/@shumoku/core.svg)](https://www.npmjs.com/package/@shumoku/core) |
| [`@shumoku/renderer`](packages/@shumoku/renderer) | SVG/HTML renderers + CLI | [![npm](https://img.shields.io/npm/v/@shumoku/renderer.svg)](https://www.npmjs.com/package/@shumoku/renderer) |
| [`@shumoku/parser-yaml`](packages/@shumoku/parser-yaml) | YAML parser | [![npm](https://img.shields.io/npm/v/@shumoku/parser-yaml.svg)](https://www.npmjs.com/package/@shumoku/parser-yaml) |
| [`@shumoku/icons`](packages/@shumoku/icons) | Vendor icons (Yamaha, Aruba, AWS, Juniper) | [![npm](https://img.shields.io/npm/v/@shumoku/icons.svg)](https://www.npmjs.com/package/@shumoku/icons) |
| [`@shumoku/netbox`](packages/@shumoku/netbox) | NetBox API integration | [![npm](https://img.shields.io/npm/v/@shumoku/netbox.svg)](https://www.npmjs.com/package/@shumoku/netbox) |

## Documentation

- [YAML Reference](https://shumoku.packof.me/docs/npm/yaml-reference) - Full YAML syntax reference
- [Vendor Icons](https://shumoku.packof.me/docs/npm/vendor-icons) - Available vendor icons

## Development

```bash
# Clone the repository
git clone https://github.com/konoe-akitoshi/shumoku.git
cd shumoku

# Install dependencies (requires Bun)
bun install

# Build all packages
bun run build

# Run playground
cd apps/playground && bun run dev
```

### Commands

```bash
bun install           # Install dependencies
bun run build         # Build all packages
bun run dev           # Run dev server
bun run typecheck     # Type check
bun run lint          # Lint
bun run format        # Format with Biome
bun run test          # Run tests
```

## License

MIT
