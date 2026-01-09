# Shumoku

<img src="apps/playground/public/logo.svg" alt="Shumoku Logo" width="128" height="128">

**撞木** - 撞木は喚鐘を叩く時に使用する丁字形の棒です。その撞木を吊り下げる釘を撞木釘と言います。

Modern network topology visualization library for TypeScript/JavaScript.

**[Playground](https://shumoku.pages.dev)** | **[Documentation](https://shumoku.pages.dev/docs/yaml-reference)**

## Features

- **YAML-based definitions** - Simple, readable network topology definitions
- **Automatic layout** - Hierarchical layout powered by ELK.js
- **Vendor icons** - Built-in icons for Yamaha, Aruba, AWS (500+ icons)
- **SVG export** - High-quality vector output
- **NetBox integration** - Auto-generate diagrams from NetBox

## Quick Start

### Online Playground

Try Shumoku without installation at [shumoku.pages.dev](https://shumoku.pages.dev)

### Local Development

```bash
# Clone the repository
git clone https://github.com/konoe-akitoshi/shumoku.git
cd shumoku

# Install dependencies (requires Bun)
bun install

# Build all packages
bun run build

# Run playground
cd apps/playground
bun run dev
```

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

| Package | Description |
|---------|-------------|
| `@shumoku/core` | Core library (models, layout, renderer) |
| `@shumoku/parser-yaml` | YAML parser for network definitions |
| `@shumoku/netbox` | NetBox API integration |

## Architecture

```
shumoku/
├── packages/
│   ├── @shumoku/core         # Core library
│   ├── @shumoku/parser-yaml  # YAML parser
│   └── @shumoku/netbox       # NetBox integration
├── apps/
│   └── playground            # Demo & documentation site
└── docs/                     # Documentation source
```

## Documentation

- [YAML Reference](https://shumoku.pages.dev/docs/yaml-reference) - Full YAML syntax reference
- [Vendor Icons](https://shumoku.pages.dev/docs/vendor-icons) - Available vendor icons

## Development

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
