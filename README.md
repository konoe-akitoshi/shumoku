# Shumoku

<img src="apps/playground/public/logo.svg" alt="Shumoku Logo" width="128" height="128">

**撞木** - 撞木は喚鐘を叩く時に使用する丁字形の棒です。その撞木を吊り下げる釘を撞木釘と言います。

Modern network topology visualization library for TypeScript/JavaScript.

[![npm version](https://img.shields.io/npm/v/shumoku.svg)](https://www.npmjs.com/package/shumoku)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[Playground](https://shumoku.packof.me/)** | **[Documentation](https://shumoku.packof.me/docs/yaml-reference)**

## Features

- **YAML-based definitions** - Simple, readable network topology definitions
- **Automatic layout** - Hierarchical layout powered by ELK.js
- **Vendor icons** - Built-in icons for Yamaha, Aruba, AWS, Juniper (900+ icons)
- **SVG export** - High-quality vector output
- **TypeScript** - Full type safety

## Installation

```bash
# Basic installation
npm install shumoku

# With vendor icons (Yamaha, Aruba, AWS, Juniper)
npm install shumoku @shumoku/icons
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
| [`@shumoku/core`](packages/@shumoku/core) | Core library (models, layout, renderer) | [![npm](https://img.shields.io/npm/v/@shumoku/core.svg)](https://www.npmjs.com/package/@shumoku/core) |
| [`@shumoku/parser-yaml`](packages/@shumoku/parser-yaml) | YAML parser | [![npm](https://img.shields.io/npm/v/@shumoku/parser-yaml.svg)](https://www.npmjs.com/package/@shumoku/parser-yaml) |
| [`@shumoku/icons`](packages/@shumoku/icons) | Vendor icons (Yamaha, Aruba, AWS, Juniper) | [![npm](https://img.shields.io/npm/v/@shumoku/icons.svg)](https://www.npmjs.com/package/@shumoku/icons) |

## Documentation

- [YAML Reference](https://shumoku.packof.me/docs/yaml-reference) - Full YAML syntax reference
- [Vendor Icons](https://shumoku.packof.me/docs/vendor-icons) - Available vendor icons

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
