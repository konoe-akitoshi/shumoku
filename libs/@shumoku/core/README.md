# @shumoku/core

Core library for Shumoku network topology visualization.

## Installation

```bash
npm install @shumoku/core
```

## Features

- **Data models** - Type-safe network topology models (Device, Port, Link, Module)
- **Layout engines** - Automatic positioning with ELK.js (hierarchical layout)
- **SVG renderer** - High-quality vector output
- **Themes** - Built-in modern and dark themes

## Usage

```typescript
import { NetworkGraph, HierarchicalLayoutEngine, SvgRenderer } from '@shumoku/core'

// Create a network graph
const graph: NetworkGraph = {
  version: '1.0.0',
  devices: [
    { id: 'router1', name: 'Router', type: 'router' },
    { id: 'switch1', name: 'Switch', type: 'l2-switch' }
  ],
  links: [
    { id: 'link1', source: 'router1', target: 'switch1' }
  ]
}

// Layout the graph
const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

// Render to SVG
const renderer = new SvgRenderer()
const svg = renderer.render(layout)
```

## Related Packages

- [`@shumoku/parser-yaml`](https://www.npmjs.com/package/@shumoku/parser-yaml) - YAML parser for network definitions
- [`@shumoku/icons`](https://www.npmjs.com/package/@shumoku/icons) - Vendor-specific icons (Yamaha, Aruba, AWS, Juniper)

## Documentation

- [Playground](https://shumoku.packof.me/) - Interactive demo
- [GitHub](https://github.com/konoe-akitoshi/shumoku)

## License

MIT
