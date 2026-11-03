# @shumoku/core

Core library for [Shumoku](https://github.com/konoe-akitoshi/shumoku) network topology visualization — the data models, the drawing layout, themes, and plugin toolkit that every other package builds on.

It is **render-agnostic and browser-safe**: it turns a network definition into a drawing scene (boxes, lines, ports), but does not emit SVG/HTML/PNG itself. Pair it with [`@shumoku/renderer-svg`](../renderer-svg), [`@shumoku/renderer-html`](../renderer-html), or [`@shumoku/renderer-png`](../renderer-png) — or just use the all-in-one [`shumoku`](../../shumoku) package.

## Install

```bash
npm install @shumoku/core
```

## Quick start

```typescript
import { readNetworkModel } from '@shumoku/core'
import { drawNetworkScene } from '@shumoku/renderer'

// 1. Read the YAML into a NetworkModel
const model = readNetworkModel(`
name: Edge
nodes:
  - { id: rt-01, type: router, product: Yamaha }
  - { id: sw-01, type: l3-switch }
links:
  - endpoints: [{ node: rt-01, port: lan1 }, { node: sw-01, port: ge-0/0/0 }]
    speed: 10G
`)

// 2. Draw it: boxes, groups, wires and ports with their coordinates
const scene = drawNetworkScene(model)
console.log(scene.nodes.length, 'nodes drawn')
```

`drawNetwork(model, { metrics, hints? })` is the entry in core. `metrics` is a function, `(model) => Metrics`, that returns the lengths the drawing works with; `drawNetworkScene(model)` in `@shumoku/renderer` supplies it from the renderer's kit, so use that unless you bring your own. `drawNetwork` does not read `model.drawing.order` itself: a caller that wants a person's drag order honoured converts it to `hints: { siblings }` (keyed by group id, or `ROOT_FRAME` for the top level). `readNetworkModel()` keeps the YAML as written in `model.config`; observation, design and drawing layers sit beside it keyed by id. `toNetworkGraph()` builds the display graph the drawing reads its nodes and links from, and `writeNetworkModel()` writes a model back as YAML.

## What's inside

| Area | Key exports |
|------|-------------|
| **Input** | `inputModel` — the YAML's shape as TS types (`Network`, `Node`, `Link`, `Segment`, …) |
| **Models** | `NetworkModel`, `readNetworkModel()`, `writeNetworkModel()`, `toNetworkGraph()`, `fromNetworkGraph()`, `applyGraphEdits()`, `resolveNetwork()`; the drawing graph `NetworkGraph`, `Node`, `Link`, `Subgraph`, `NodePort`, `GraphSettings` |
| **Drawing** | `drawNetwork()` (primary entry), `layoutDrawing()`, `drawingBoundary()`; the `DrawingScene` it returns; `DrawHints` (the order of siblings the engine honours) and `DrawingLayer.order` (the order a person dragged siblings into, which the caller turns into `DrawHints`) |
| **Themes** | `lightTheme`, `darkTheme` presets; `createTheme()`, `mergeTheme()` utilities |
| **Icons** | `iconSets` (the bundled icon sets) and icon resolution / dimension helpers |
| **Fixtures** | `sampleNetworkModel()` / `sampleNetworkYaml` — the demo network used across the test suite |
| **Plugin types** | `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`, `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`, `Alert`, `AlertSeverity`, `MetricsData` |
| **Plugin kit** | `flattenObject`, `stampObserved`, `validateAgainstSchema`, `mapAlertmanagerSeverity`, and other pure helpers for plugin authors |

> The old layout engine (`computeNetworkLayout()`, `createEngine()`, `routeEdges()`, the `@shumoku/core/layout` subpath, hierarchical sheets) has been removed; the drawing is `drawNetwork()`. Rendering lives in the renderer packages.

## Subpath exports

For smaller imports you can reach into a single area instead of the package root:

```typescript
import { Node, Link } from '@shumoku/core/models'
import { readNetworkModel, toNetworkGraph } from '@shumoku/core/models'
import { darkTheme } from '@shumoku/core/themes'
import { iconSets } from '@shumoku/core/icons'
```

The plugin-kit helpers and plugin types are exported from the package **root** (`@shumoku/core`), not a subpath.

## For plugin authors

Plugins implement `DataSourcePlugin` and translate their upstream vocabulary into core's neutral types at the boundary — core types are the display contract. The plugin kit gives you the shared building blocks (severity mapping, Alertmanager parsing, generic record flattening, observation stamping, schema validation) so every plugin behaves consistently. See [Plugin Authoring](../../../docs/plugin-authoring.md) for the full reference, and [`libs/plugins/zabbix`](../../plugins/zabbix) for a complete example.

## License

AGPL-3.0-only. For commercial licensing, contact contact@shumoku.dev.
