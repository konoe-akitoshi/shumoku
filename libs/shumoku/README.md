# Shumoku

Modern network topology visualization library for TypeScript/JavaScript.

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
    vendor: yamaha
    model: rtx3510

  - id: switch
    label: "Main Switch"
    type: l2-switch

links:
  - from: { node: router }
    to: { node: switch }
    bandwidth: 10G
`

// Parse YAML to network graph
const parser = new YamlParser()
const graph = parser.parse(yaml)

// Layout the graph
const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

// Render to SVG
const renderer = new SvgRenderer()
const svg = renderer.render(layout)
```

## Features

- **YAML-based definitions** - Simple, readable network topology definitions
- **Automatic layout** - Hierarchical layout powered by ELK.js
- **Vendor icons** - Built-in icons for Yamaha, Aruba, AWS, Juniper (900+ icons)
- **SVG export** - High-quality vector output
- **TypeScript** - Full type safety

## Included Packages

This package bundles:

- [`@shumoku/core`](https://www.npmjs.com/package/@shumoku/core) - Core library (models, layout, renderer)
- [`@shumoku/parser-yaml`](https://www.npmjs.com/package/@shumoku/parser-yaml) - YAML parser
- [`@shumoku/icons`](https://www.npmjs.com/package/@shumoku/icons) - Vendor-specific icons (900+)

## Documentation

- [Playground](https://shumoku.packof.me/) - Interactive demo
- [YAML Reference](https://shumoku.packof.me/docs/npm/yaml-reference) - Full syntax reference
- [GitHub](https://github.com/konoe-akitoshi/shumoku)

## License

MIT
