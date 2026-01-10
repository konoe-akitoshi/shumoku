# @shumoku/parser-yaml

YAML parser for Shumoku network topology definitions.

## Installation

```bash
npm install @shumoku/parser-yaml @shumoku/core
```

## Usage

```typescript
import { YamlParser } from '@shumoku/parser-yaml'

const yaml = `
name: "Simple Network"

settings:
  direction: TB
  theme: light

nodes:
  - id: rt-01
    label: "Router 01"
    type: router

  - id: sw-01
    label: "Switch 01"
    type: l2-switch

links:
  - from:
      node: rt-01
      port: lan1
    to:
      node: sw-01
      port: ge-0/0/0
    bandwidth: 10G
`

const parser = new YamlParser()
const graph = parser.parse(yaml)
```

## YAML Schema

### Nodes

```yaml
nodes:
  - id: router-01
    label: "Core Router"
    type: router          # router, l2-switch, l3-switch, firewall, server, etc.
    vendor: yamaha        # Optional: yamaha, aruba, aws, juniper
    model: rtx3510        # Optional: vendor-specific model
    parent: core-layer    # Optional: subgraph ID
```

### Links

```yaml
links:
  - from:
      node: router-01
      port: lan1
    to:
      node: switch-01
      port: ge-0/0/0
    bandwidth: 10G        # Optional
    label: "Uplink"       # Optional
```

### Subgraphs

```yaml
subgraphs:
  - id: core-layer
    label: "Core Layer"
```

## Related Packages

- [`@shumoku/core`](https://www.npmjs.com/package/@shumoku/core) - Core library
- [`@shumoku/icons`](https://www.npmjs.com/package/@shumoku/icons) - Vendor icons

## Documentation

- [YAML Reference](https://shumoku.packof.me/docs/yaml-reference) - Full syntax reference
- [Playground](https://shumoku.packof.me/) - Interactive demo

## License

MIT
