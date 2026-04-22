# neted Data Model

## Project File (.neted.json)

```
NetedProject
├── version: 1
├── name: string
├── settings?: Record<string, unknown>
├── palette: SpecPaletteEntry[]
│   └── { id, source, catalogId?, spec: NodeSpec, properties?, notes? }
│       └── NodeSpec = HardwareSpec | ComputeSpec | ServiceSpec
│           ├── { kind: 'hardware', type?: DeviceType, vendor?, model? }
│           ├── { kind: 'compute', type?: DeviceType, platform?, vendor? }
│           └── { kind: 'service', service, resource?, vendor? }
├── bom: BomItem[]
│   └── { id, paletteId?, nodeId?, notes? }
└── diagram: NetworkGraph                   ← library type directly
    ├── nodes: Node[]                       ← position set on save
    │   └── { id, label, shape, spec?, position?, parent?, rank?, style? }
    ├── links: Link[]
    │   └── { id, from, to, bandwidth?, type?, vlan?, arrow?, redundancy? }
    │       └── from/to = string | LinkEndpoint { node, port?, ip? }
    ├── subgraphs?: Subgraph[]              ← bounds set on save
    │   └── { id, label, children?, parent?, bounds?, direction?, pins? }
    └── settings?: GraphSettings
```

Derived values (not stored on the NetworkGraph save wire):
- Node size — computed by `computeNodeSize()` from label/spec/shape
- Ports (`absolutePosition`, `side`) — computed by `placePorts()` from node positions + link endpoints
- Edges (routed paths) — computed by `routeEdges()` (libavoid WASM) from nodes/ports/links

## Runtime State (context.svelte.ts)

```
diagram ($state, single object)       SvelteMap-based (reactive)
├── nodes: SvelteMap<id, Node>        ← positioned, source of truth
├── subgraphs: SvelteMap<id, Subgraph>
├── links: Link[]
├── ports: SvelteMap<id, ResolvedPort>  ← derived, rebuilt by placePorts() on load / rerouteEdges()
├── edges: SvelteMap<id, ResolvedEdge>  ← derived, rebuilt by routeEdges() via rerouteEdges()
└── bounds: { x, y, width, height }

palette: SpecPaletteEntry[]           separate $state
bomItems: BomItem[]                   separate $state
poeBudgets: PoEBudget[]               derived from nodes + links + catalog
```

`ResolvedNode` / `ResolvedSubgraph` wrapper types were removed in #115 —
the runtime Maps hold `Node` / `Subgraph` directly.

## Data Flow

```
diagram  <──$bindable──>  ShumokuRenderer (bidirectional)
  |                            |
  | diagramState.xxx           | drag / link / delete
  | (getter/setter)            |
  v                            v
Connections page           diagram page
BOM page                   SideToolbar
Specs page                 ContextMenu

save:  exportGraph()  ->  NetworkGraph (Node[] with positions)  ->  JSON
load:  NetworkGraph  ->  importGraph()  ->  state + placePorts + routeEdges
       └─ if any node lacks position → falls back to computeNetworkLayout (full layoutNetwork pass)
```

### Load pipeline

Loads follow a linear pipeline — each step converts its input one level
up and forwards to the next. `loadProject` is the terminal: it owns
state reset, the `initialized` flag, and status.

```
applyYaml(yaml)          YAML  →  NetedProject (current palette/bom preserved)
     │
     ▼
importProject(input)     NetedProject (string or object)  →  loadProject('imported', data)
     │
     ▼
loadProject(id, data?)   reset state + applyProject(data or builtin)
```

The two adapters (`applyYaml`, `importProject`) are thin: conversion +
forward. Private helpers `applyProject` / `applyGraph` live module-scoped
and handle sanitize + `placePorts` + `routeEdges`. Every load — sample,
YAML paste, JSON drop — passes through the same terminal.

### Individual node placement

`placeNode(node, graph, initial, gap?)` in `@shumoku/core` is the
primitive for placing one unpositioned node with collision avoidance
against the existing graph. It is the lightweight counterpart to
`layoutNetwork`, which rebuilds the entire layout from scratch.
