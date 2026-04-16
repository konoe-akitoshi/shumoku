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
    ├── nodes: Node[]                       ← position? set by editor/engine
    │   └── { id, label, shape, spec?, position?, parent?, rank?, style? }
    ├── links: Link[]
    │   └── { id, from, to, bandwidth?, type?, vlan?, arrow?, redundancy? }
    │       └── from/to = string | LinkEndpoint { node, port?, ip? }
    ├── subgraphs?: Subgraph[]              ← bounds derived from children
    │   └── { id, label, children?, parent?, direction?, pins? }
    └── settings?: GraphSettings
```

Derived values (not stored):
- Node size — computed by `computeNodeSize()` from label/spec/shape
- Subgraph bounds — computed from child node positions + padding
- Ports — computed from node positions + link endpoints
- Edges — computed by `routeEdges()` (libavoid WASM) from nodes/ports/links

## Runtime State (context.svelte.ts)

```
diagram ($state, single object)       Map-based (renderer compat)
├── nodes: Map<id, ResolvedNode>      ← wraps Node with computed position/size
├── ports: Map<id, ResolvedPort>      ← derived, recomputed on load
├── edges: Map<id, ResolvedEdge>      ← derived, recomputed via rerouteEdges()
├── subgraphs: Map<id, ResolvedSubgraph>
├── bounds: { x, y, width, height }
└── links: Link[]

palette: SpecPaletteEntry[]           separate $state
bomItems: BomItem[]                   separate $state
poeBudgets: PoEBudget[]               derived from nodes + links + catalog
```

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
load:  JSON  ->  importGraph()  ->  Node[] → ResolvedNode Map + recompute ports/edges
```
