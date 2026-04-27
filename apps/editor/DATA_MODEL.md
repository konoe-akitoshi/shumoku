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
    │   └── { id, label, shape, spec?, ports?, position?, parent?, rank?, style? }
    │       └── ports = NodePort[]  ← concrete device/interface snapshot
    ├── links: Link[]
    │   └── { id, from, to, bandwidth?, medium?, type?, vlan?, arrow?, redundancy? }
    │       └── from/to = string | LinkEndpoint { node, port?, portIntent?, ip? }
    ├── subgraphs?: Subgraph[]              ← bounds set on save
    │   └── { id, label, children?, parent?, bounds?, direction?, pins? }
    └── settings?: GraphSettings
```

Derived values (not stored on the NetworkGraph save wire):
- Node size — computed by `computeNodeSize()` from label/spec/shape
- Resolved ports (`absolutePosition`, `side`) — computed by `placePorts()` from node positions + assigned link endpoints
- Edges (routed paths) — computed by `routeEdges()` (libavoid WASM) from nodes/ports/links

Port and cable modeling:
- `NodePort.id` is the internal stable reference used by `LinkEndpoint.port`.
- `NodePort.label` is the user-facing interface label, e.g. `Gi1/0/1`, `ge-0/0/0`, `E0`.
- `NodePort.connector` is the physical port/cage type, e.g. `rj45`, `sfp+`, `qsfp28`.
- `NodePort.poe` is only valid for PoE-capable copper ports, normally `rj45`.
- `Link.medium` describes what is actually installed between ports: twisted pair, fiber, DAC, or AOC. Fiber mode (`singlemode`/`multimode`) belongs here, not on the port.
- `faceplateLabel` and `interfaceName` are optional metadata for physical markings and OS/API names.

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

### Placement APIs — two primitives, two intents

`@shumoku/core` exposes two placement functions. They cover different
use cases and are intentionally kept separate rather than collapsed
into one:

| | `placeNode` | `layoutNetwork` |
|---|---|---|
| Intent | **Geometric** (put it at this point) | **Structural** (arrange by link flow) |
| Input | One node + initial (x, y) | Whole graph |
| Algorithm | Collision-avoidance around initial | Sugiyama: cycles → layers → ordering → coords |
| Honours structure | No — links ignored | Yes — layers follow flow direction |
| Cost | O(existing obstacles) | O(V + E), libavoid-class |
| Use for | User drop / paste / "add here" | Auto-arrange / re-layout / YAML import |

`layoutNetwork` accepts two knobs for selective placement:

  - **`fixed: Set<string>`** — hard constraint. Listed nodes are snapped
    back to their input positions after Sugiyama; their ports shift
    with them and subgraph bounds are recomputed.
  - **`hints: Map<string, { x }>`** — soft constraint. Listed nodes
    use the hint as their preferred x in the coord pass; packing
    still prevents overlap, so the final x may drift in tight
    neighbourhoods.

"Arrange selection" = `layoutNetwork({ fixed: nonSelectedIds })`;
"Nudge these nodes toward this x" = `layoutNetwork({ hints })`.
Click-to-drop = `placeNode`.
