# @shumoku/core

Core library for [Shumoku](https://github.com/konoe-akitoshi/shumoku) network topology visualization — the data models, parser, layout engine, themes, and plugin toolkit that every other package builds on.

It is **render-agnostic and browser-safe**: it turns a network definition into a positioned layout, but does not emit SVG/HTML/PNG itself. Pair it with [`@shumoku/renderer-svg`](../renderer-svg), [`@shumoku/renderer-html`](../renderer-html), or [`@shumoku/renderer-png`](../renderer-png) — or just use the all-in-one [`shumoku`](../../shumoku) package.

## Install

```bash
npm install @shumoku/core
```

## Quick start

```typescript
import { computeNetworkLayout, readNetworkModel, toNetworkGraph } from '@shumoku/core'

// 1. Read the YAML into a NetworkModel, and draw it as a NetworkGraph
const model = readNetworkModel(`
name: Edge
nodes:
  - { id: rt-01, type: router, product: Yamaha }
  - { id: sw-01, type: l3-switch }
links:
  - endpoints: [{ node: rt-01, port: lan1 }, { node: sw-01, port: ge-0/0/0 }]
    speed: 10G
`)
const graph = toNetworkGraph(model)

// 2. Compute positions (Sugiyama-style tiered layout)
const { resolved } = await computeNetworkLayout(graph)

// `resolved` holds positioned nodes, ports, edges and subgraphs — hand it to a renderer.
console.log(resolved.nodes.size, 'nodes placed')
```

`readNetworkModel()` keeps the YAML as written in `model.config`; observation, design and drawing layers sit beside it keyed by id. `toNetworkGraph()` builds the graph that layout and the renderers read, and `writeNetworkModel()` writes a model back as YAML.

## What's inside

| Area | Key exports |
|------|-------------|
| **Input** | `inputModel` — the YAML's shape as TS types (`Network`, `Node`, `Link`, `Segment`, …) |
| **Models** | `NetworkModel`, `readNetworkModel()`, `writeNetworkModel()`, `toNetworkGraph()`, `fromNetworkGraph()`, `applyGraphEdits()`, `resolveNetwork()`; the drawing graph `NetworkGraph`, `Node`, `Link`, `Subgraph`, `Port`, `NetworkSettings` |
| **Layout** | `computeNetworkLayout()` (primary entry), `createEngine()`, `routeEdges()`, `verifyLayoutConstraints()` (registry-driven checks — `LAYOUT_CONSTRAINTS`) |
| **Themes** | `lightTheme`, `darkTheme` presets; `createTheme()`, `mergeTheme()` utilities |
| **Icons** | icon ID constants and dimension helpers |
| **Fixtures** | `sampleNetworkModel()` / `sampleNetworkYaml` — the demo network used across the test suite |
| **Plugin types** | `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`, `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`, `Alert`, `AlertSeverity`, `MetricsData` |
| **Plugin kit** | `flattenObject`, `stampObserved`, `validateAgainstSchema`, `mapAlertmanagerSeverity`, and other pure helpers for plugin authors |

> The old class-based API (`HierarchicalLayoutEngine`, `SvgRenderer`) has been removed. Layout is now the function `computeNetworkLayout()`; rendering moved to the dedicated renderer packages.

## Subpath exports

For smaller imports you can reach into a single area instead of the package root:

```typescript
import { Node, Link } from '@shumoku/core/models'
import { readNetworkModel, toNetworkGraph } from '@shumoku/core/models'
import { computeNetworkLayout } from '@shumoku/core/layout'
import { darkTheme } from '@shumoku/core/themes'
import { ICON_IDS } from '@shumoku/core/icons'
```

The plugin-kit helpers and plugin types are exported from the package **root** (`@shumoku/core`), not a subpath.

## For plugin authors

Plugins implement `DataSourcePlugin` and translate their upstream vocabulary into core's neutral types at the boundary — core types are the display contract. The plugin kit gives you the shared building blocks (severity mapping, Alertmanager parsing, generic record flattening, observation stamping, schema validation) so every plugin behaves consistently. See [Plugin Authoring](../../../docs/plugin-authoring.md) for the full reference, and [`libs/plugins/zabbix`](../../plugins/zabbix) for a complete example.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
