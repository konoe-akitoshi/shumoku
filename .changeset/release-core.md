---
'@shumoku/core': minor
---

**A new network input, a new model and a new drawing engine.** This release changes how shumoku reads a network and how it draws one. Neither the old YAML nor the old layout API carries over: rewrite the YAML in the new shape, and move to the APIs below.

### Reading a network

- The network YAML has a new shape: `nodes`, `links` with two `endpoints` (a node and its port, a segment, or a routing domain), `groups`, `segments`, `redundancy`, `routingDomains` and `connections`. The types are in the `inputModel` namespace, and the YAML reference is generated from them. The older YAML (`settings`, `subgraphs`, `from` / `to`, …) and graph JSON are not read and have no converter.
- `readNetworkModel(text)` reads YAML into a `NetworkModel`. It refuses a network it cannot read as written and lists every issue at once, each with its path: an unknown field (with the closest name), a value of the wrong shape, or an id nothing defines. It throws a `NetworkInputError` carrying the issues; `checkNetwork(value)` returns them without throwing. `writeNetworkModel` writes the configuration back as YAML.
- `NetworkModel` is the configuration as the YAML writes it (`config`), what each source discovered (`sources`), and the `observation`, `design` and `drawing` layers keyed by the configuration's ids.
  - `toNetworkGraph` and `fromNetworkGraph` convert to and from the display graph.
  - `applyGraphEdits(model, drawn, edited)` writes edits made on a drawn graph back into the model and keeps what the graph cannot say.
  - `resolveNetwork` merges the model with each source's `SourceNetwork`.
- The sample network is `sampleNetworkModel()` (YAML: `sampleNetworkYaml`).

### Drawing

- `drawNetwork(model, { metrics, hints })` draws a model as a `Scene`: boxes, ports, wires with their corner radii, group frames and hulls. `metrics` is a function `(model) => Metrics`; `drawNetworkScene(model)` in `@shumoku/renderer` supplies the kit's. `layoutDrawing` is the layout behind it, and `deriveStructure` gives the structure it measures from.
- Every discrete choice (ranks, left-to-right order, routes, the order of lines) is made from the network's relations before any coordinate. The coordinates are then solved once per axis, so text that measures a little differently moves things a little and changes nothing else.
- Up and down are measured from a boundary, decided in this order:
  1. `drawing.settings.boundary`;
  2. nodes with both a cable and a virtual link;
  3. `external` / `cloud` nodes and the routing domains links reach;
  4. for each connected part none of these reaches, a guessed upstream: by node type (router, firewall, VPN, CPE, then L3 switch and load balancer, then L2 switch, then access point), then the fastest link, then the centre of the part.
- Lines are orthogonal, with 45° chamfers and rounded corners. Nested groups are drawn on one page.
- `hints.siblings` fixes the left-to-right order of a frame's children where the structure leaves them free. `DrawingLayer.order` keeps the order a person dragged them into (`ROOT_FRAME` for the top level). `drawNetwork` does not read it by itself: pass it as `hints`.

### Plugins

- Topology plugins return what they discovered as a `SourceNetwork`: the network in the input's shape, with identity and provenance in its observation layer, port facts in its design layer and icons in its drawing layer. `fetchTopology()` resolves to one, `Snapshot.source` holds one (it was `Snapshot.graph`), and `validateTopologyIdentityContract` checks one. `sourceToGraph` builds a graph from it, and `rateFromBps` writes a rate the way the input does.

### Removed

- The old layout engine: `computeNetworkLayout`, `createNetworkLayoutEngine`, `createEngine`, `routeEdges`, `placePorts`, `moveNode`, `rebalanceSubgraphs`, `collectObstacles`, `buildHierarchicalSheets`, the `Resolved*` types, `LayoutResult`, the node-size and port-label constants, and the `@shumoku/core/layout` subpath.
- The old parser: `YamlParser`, `HierarchicalParser`, the file resolvers, `dumpGraph`, and the `@shumoku/core/parser` and `@shumoku/core/parser/node` subpaths.
- Sheets and hierarchical views (`file:` / `pins`).
- Line styles the drawing does not draw: `ArrowType` and `LinkDrawing.arrow`, `EdgeStyle` / `SplineMode` and the `edgeStyle` / `splineMode` settings, and the `'solid'`, `'double'`, `'thick'` and `'invisible'` link types. `LinkType` is `'dashed' | 'dotted'`, and a link with no type is solid.
- `Node.rank`.
- `parseWithMaps` / `stringifyWithMaps` and the presentation helpers only the old renderers used.

### Renamed

- `Link.rateBps` is now `speedBps`: the link's nominal speed, not its traffic. Ask `linkSpeedBps(link)`, which also reads the speed its ends' module standards name.

### Migrating

| Before | Now |
| --- | --- |
| `new YamlParser().parse(text)` | `readNetworkModel(text)`, then `toNetworkGraph(model)` if you need the graph |
| `computeNetworkLayout(graph)` | `drawNetwork(model, { metrics })`, or `drawNetworkScene(model)` from `@shumoku/renderer` |
| `@shumoku/core/layout`, `@shumoku/core/parser` | removed; import from `@shumoku/core` |
| `link.rateBps` | `linkSpeedBps(link)` |
| `sampleNetwork` | `sampleNetworkModel()` |

### Fixed

- `checkNetwork` reports an unknown top-level field as an issue. It used to throw a `ReferenceError`.
