# @shumoku/core

Core library for [Shumoku](https://github.com/konoe-akitoshi/shumoku) network topology visualization — the data models, parser, layout engine, themes, and plugin toolkit that every other package builds on.

It is **render-agnostic and browser-safe**: it turns a network definition into a positioned layout, but does not emit SVG/HTML/PNG itself. Pair it with [`@shumoku/renderer-svg`](../renderer-svg), [`@shumoku/renderer-html`](../renderer-html), or [`@shumoku/renderer-png`](../renderer-png) — or just use the all-in-one [`shumoku`](../../shumoku) package.

## Install

```bash
npm install @shumoku/core
```

## Quick start

```typescript
import { YamlParser, computeNetworkLayout } from '@shumoku/core'

// 1. Parse YAML into a NetworkGraph
const { graph, warnings } = new YamlParser().parse(`
name: Edge
nodes:
  - id: rt-01
    type: router
    vendor: yamaha
  - id: sw-01
    type: l3-switch
links:
  - from: { node: rt-01, port: lan1 }
    to:   { node: sw-01, port: ge-0/0/0 }
    bandwidth: 10G
`)

// 2. Compute positions (Sugiyama-style tiered layout)
const layout = await computeNetworkLayout(graph)

// `layout` holds positioned nodes, links, and subgraphs — hand it to a renderer.
console.log(layout.nodes.length, 'nodes placed')
```

`YamlParser.parse()` returns `{ graph: NetworkGraph, warnings?: ParseWarning[] }` — it never throws on recoverable issues; check `warnings` instead.

## What's inside

| Area | Key exports |
|------|-------------|
| **Models** | `NetworkGraph`, `Node`, `Link`, `Subgraph`, `Port`, `NetworkSettings` |
| **Parser** | `YamlParser` (single file), `HierarchicalParser` (multi-file `file:` references), `parser` (shared instance) |
| **Layout** | `computeNetworkLayout()` (primary entry), `createEngine()`, `routeEdges()`, `checkLayoutInvariants()` |
| **Themes** | `lightTheme`, `darkTheme` presets; `createTheme()`, `mergeTheme()` utilities |
| **Icons** | icon ID constants and dimension helpers |
| **Fixtures** | `sampleNetwork` — a multi-file demo network used across the test suite |
| **Plugin types** | `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`, `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`, `Alert`, `AlertSeverity`, `MetricsData` |
| **Plugin kit** | `flattenObject`, `stampObserved`, `validateAgainstSchema`, `mapAlertmanagerSeverity`, and other pure helpers for plugin authors |

> The old class-based API (`HierarchicalLayoutEngine`, `SvgRenderer`) has been removed. Layout is now the function `computeNetworkLayout()`; rendering moved to the dedicated renderer packages.

## Subpath exports

For smaller imports you can reach into a single area instead of the package root:

```typescript
import { Node, Link } from '@shumoku/core/models'
import { YamlParser } from '@shumoku/core/parser'
import { computeNetworkLayout } from '@shumoku/core/layout'
import { darkTheme } from '@shumoku/core/themes'
import { ICON_IDS } from '@shumoku/core/icons'
```

The plugin-kit helpers and plugin types are exported from the package **root** (`@shumoku/core`), not a subpath.

## For plugin authors

Plugins implement `DataSourcePlugin` and translate their upstream vocabulary into core's neutral types at the boundary — core types are the display contract. The plugin kit gives you the shared building blocks (severity mapping, Alertmanager parsing, generic record flattening, observation stamping, schema validation) so every plugin behaves consistently. See [Plugin Authoring](../../../docs/plugin-authoring.md) for the full reference, and [`libs/plugins/zabbix`](../../plugins/zabbix) for a complete example.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
