# shumoku 🔧

Modern network topology visualization library for Markdown

## Overview

shumoku is a powerful network diagram library designed specifically for network engineers and infrastructure teams. It allows you to create beautiful, interactive network topology diagrams directly in Markdown files.

### Features

- 📝 **Markdown-native**: Embed diagrams directly in your documentation
- 🎨 **Beautiful designs**: Modern Bento Grid-style layouts
- 🚀 **High performance**: WebGL-based rendering for large networks
- 🔌 **NetBox integration**: Auto-generate diagrams from your source of truth
- 🤖 **Smart layouts**: AI-assisted automatic node placement
- 📦 **Export options**: PNG, SVG, and more
- ♿ **Accessible**: Full keyboard navigation and screen reader support

## Current Status (v0.0.0)

This is an early development version. The following components are implemented:

### ✅ Implemented
- **Core Library** (`@shumoku/core`)
  - Network data models (Device, Port, Link, Module)
  - Layout engines (Hierarchical, Bento Grid)
  - Theme system (Modern/Light, Dark)
  - Parser interface
- **Basic Playground App**
  - Layout engine testing
  - Theme switching

### 🚧 In Progress
- YAML parser (`@shumoku/parser-yaml`)
- Pixi.js renderer
- React components (`@shumoku/react`)

### 📋 Planned
- Full visualization with Pixi.js
- Markdown integration
- NetBox API support
- GitHub Actions
- Export functionality

## Quick Start

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/shumoku.git
cd shumoku

# Install dependencies
pnpm install

# Build core library
pnpm build

# Run playground
cd apps/playground
pnpm dev
```

### Example Usage (Current API)

```typescript
import { 
  DeviceType,
  layoutEngineFactory,
  type NetworkGraph 
} from '@shumoku/core'

// Define your network
const network: NetworkGraph = {
  version: '1.0.0',
  name: 'My Network',
  devices: [
    {
      id: 'sw1',
      name: 'Switch 1',
      type: DeviceType.L3Switch,
      role: 'core'
    }
  ],
  links: [],
  ports: []
}

// Generate layout
const engine = layoutEngineFactory.create('hierarchical')
const layout = await engine.layout(network)
```

## Architecture

```
shumoku/
├── packages/
│   ├── @shumoku/core         # Core library (models, layout, themes)
│   ├── @shumoku/parser-yaml  # YAML parser
│   └── @shumoku/react        # React components (planned)
├── apps/
│   └── playground            # Demo application
└── examples/                 # Example network definitions
```

## Network Definition Format

```yaml
network:
  name: "Data Center Network"
  layout: bento
  theme: modern
  
  modules:
    - id: core
      name: "Core Network"
      devices: ["router1", "router2"]
      
  devices:
    - id: router1
      name: "Core Router 1"
      type: router
      role: core
      
    - id: router2
      name: "Core Router 2"
      type: router
      role: core
      
  links:
    - from: router1
      to: router2
      bandwidth: "40G"
      type: physical
```

## Contributing

This project is in early development. Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Format code
pnpm format
```

## License

MIT © 2024 shumoku contributors