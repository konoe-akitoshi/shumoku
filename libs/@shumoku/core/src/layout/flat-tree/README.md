# Flat-Tree Layout Engine

A Buchheim-derived hierarchical layout for network topology diagrams, with first-class support for **subgraphs as visual groupings** (rather than nested containers).

The engine takes a `NetworkGraph` (nodes, links, subgraphs) and produces absolute node positions and per-subgraph bounding rectangles. The pipeline is deterministic, linear-time in the number of nodes for typical tree-dominant inputs, and pure TypeScript (no external layout libraries, no WASM).

## Why a custom engine

Existing JS layout libraries (dagre, ELK, graphviz-wasm) treat subgraphs as **layout containers** — each subgraph's contents are arranged together as a sub-problem and the parent layout positions the whole container. That works for general graph drawing but fights the network-engineering reading model:

- A switch fanning out to "5 different rooms" reads more naturally when the rooms expand sideways and downward independently than when they're forced into one row by their shared container.
- Wires that originate inside a subgraph and leave it (e.g. a router's uplink to a different rack) get awkward routes because the layout treats the subgraph boundary as a wall.

The flat-tree engine treats **every node as a peer in one big Buchheim tidy-tree** and computes subgraph rectangles as a post-process *hull* around their members. The hulls don't constrain layout; they just visualise grouping.

## Pipeline

```
NetworkGraph
    │
    ▼ ── 1. Primary parents ────────── parents.ts
    │       buildPrimaryParents
    │       breakCycles
    │
    ▼ ── 2. Block partition ────────── blocks.ts
    │       buildBlocks
    │       findExternalEmitterBlocks
    │
    ▼ ── 3. Internal layouts ───────── internal.ts
    │       layoutBlockInternal
    │       │   ├── single-member
    │       │   ├── multi-root subtree row (default)
    │       │   └── emitter-with-side-chain (special)
    │
    ▼ ── 4. Outer tree ───────────────  outer.ts + sort.ts
    │       buildBlockParents
    │       buildBlockChildren
    │       sortBlocksBySourcePort
    │       layoutTree (Buchheim — tree-layout.ts)
    │
    ▼ ── 5. Spine alignment ────────── spine.ts
    │       alignSameSubgraphSpine
    │
    ▼ ── 6. Expand to node coords ──── (in index.ts)
    │
    ▼ ── 7. Subgraph hulls + bbox ──── hulls.ts
    │       computeSubgraphHulls
    │
FlatTreeLayoutResult
```

Each phase is a pure function; together they implement `layoutFlatTree`.

## Terminology

- **Primary parent.** Each node has at most one "tree parent" — the source side of the structural link that brought it into the tree. Multiple incoming links degrade to a tree + overlays; cycles are broken arbitrarily.

- **Block.** An opaque group of nodes the outer tidy-tree treats as a single unit. Block formation depends on subgraph membership and emitter status (below).

- **Emitter.** A node that emits at least one tree-edge across its subgraph boundary. The "upstream switch with a downlink to a core router below" is the prototypical emitter.

- **Single-emitter subgraph** (the common case): the whole subgraph collapses to one block, members are arranged via the block-internal layout.

- **Multi-emitter subgraph**: splits into one block per emitter. Non-emitter members join the block of their nearest tree-parent emitter inside the same subgraph. This lets the outer tidy-tree place each emitter's external children at its own depth.

- **External-emitter block.** A block whose intra-root member emits a tree-edge to outside the block. Layout switches to the emitter-with-side-chain variant so the root's downlink column stays clear.

- **Intra-root.** A block member whose primary parent lives outside the block (or absent). Blocks have ≥1 intra-root; multi-root blocks lay out side-by-side subtrees.

- **Spine.** A child block in the same subgraph as its outer-tree parent. The spine-alignment pass shifts the sibling cluster so the spine shares the parent's x — multi-emitter subgraphs render as narrow vertical strips instead of wide L-shapes.

## Invariants

The engine guarantees:

1. **Subtree contiguity.** Children of the same parent are spatially contiguous; outsider subtrees don't interleave. (Buchheim invariant, preserved by the outer tidy-tree.)

2. **Subgraph hull non-overlap.** No two sibling subgraph hulls overlap. The block size reported to tidy-tree includes the hull padding, so adjacent hulls touch but never intersect. (Sibling here means "not in an ancestor-descendant relationship via subgraph nesting".)

3. **Determinism.** Same input → same output. Sibling ordering tie-breaks by id; intra-root selection sorts by id; spine alignment processes blocks in BFS-deterministic order.

4. **Hull tightness.** Each subgraph's bounding rectangle is the smallest axis-aligned bbox covering all its members + padding + label height.

5. **Same-subgraph chain alignment.** When a subgraph spans two stacked emitter blocks (e.g. New Group with eps-sw01 above eps-sw02), the lower block's x is pulled onto the upper block's x by the spine pass. The subgraph hull then reads as a narrow vertical strip.

## Complexity

For a graph with N nodes, L links, S subgraphs:

| Phase | Time |
|---|---|
| Primary parents | O(L) |
| Break cycles | O(N) amortised |
| Block partition | O(N + L) |
| Internal layouts | O(N) total (each node touched once across all blocks) |
| Outer tree assembly | O(B²) worst case for sibling sort (B = block count), typically O(B log B) |
| Buchheim (`layoutTree`) | O(B) |
| Spine alignment | O(B) |
| Hull computation | O(N + S) |

Overall: **O(N + L + B log B)** in practice. For network topologies B ≪ N (subgraphs absorb most nodes), so total is close to linear in N.

## Where the engine refuses to be clever

A few cases the engine *deliberately* doesn't optimise:

- **Crossing minimisation across siblings.** The sort key is source-port label, not a barycenter heuristic. Crossings between unrelated subtrees can happen; we'd rather have predictable port sequences than minimise N more crossings per layout.

- **Wire routing.** The engine produces node positions only. Edge routing is a separate pass (currently per-port bezier).

- **Disconnected components.** Each gets laid out from its own root, then tidy-tree's apportion packs them horizontally without contour overlap. There is **no 2D bin-packing** — when a deep narrow component sits next to a shallow wide one, the vertical space under the wide component is left empty. A post-process bin-pack would reduce wasted canvas at the cost of breaking left-to-right reading order; the engine deliberately preserves the reading order.

- **Heuristic re-balancing.** No multi-start search, no simulated annealing, no quality-function-driven re-layout. The deterministic output is good enough on typical network fixtures; making it better requires either (a) explicit user intent on individual nodes or (b) accepting non-determinism.

## Public API

```ts
import { createFlatTreeEngine } from '@shumoku/core/layout/flat-tree'

const engine = createFlatTreeEngine()
const result = engine.layout(graph, {
  sizeById,            // Map<string, { width: number; height: number }>
  shouldFlip,          // optional, defaults to never flipping
  direction: 'TB',     // 'TB' | 'BT' | 'LR' | 'RL', default 'TB'
  pinned: new Map([    // optional pin map
    ['router-1', { x: 100, y: 200 }],
  ]),
  metrics: {           // optional renderer-supplied measurements
    fontEmSize: 12,
    portLabelOuterReach: 21,
    subgraphLabelHeight: 28,
  },
})

result.nodePositions       // Map<string, {x,y}>
result.subgraphBounds      // Map<string, Bounds>
result.rootBounds          // Bounds
result.diagnostics         // Diagnostic[]
```

The factory `createFlatTreeEngine()` is the recommended entry point. The lower-level `layoutFlatTree(graph, nodesById, subgraphsById, sizeById, shouldFlip, options)` stays exported for callers that need the unwrapped form (existing `network-layout.ts` wiring).

### Direction

The engine computes everything in TB orientation internally and rotates the final result. Pin positions are interpreted in the final coord system.

### Diagnostics

`result.diagnostics` reports input-validation warnings (duplicate node ids, dangling subgraph parents, links to missing nodes, missing node sizes) and engine info (self-loops). Empty array means clean input.

Pass `{ explain: true }` to additionally surface per-decision *explainability* diagnostics — `block-join` (why each node ended up in its block), `sibling-order` (what key decided the order under each parent), `spine-aligned` (where the spine pass fired), `cycle-broken` (which edge was dropped to break a primary-parent cycle). These are info-level and verbose; off by default so production callers don't pay the cost. Useful when investigating a layout that looks wrong.

### Pinned positions

Pinning a node snaps it to the target position. The node's subgraph cluster shifts together so the group stays intact; other subgraphs are unaffected. Subgraph hulls re-compute after pin application.

### Metrics-driven spacing

Every gap, padding and label-band height the engine uses is computed by `deriveSpacing(metrics, overrides)` in `./spacing.ts`. The pipeline never reads a hardcoded gap value — `index.ts` derives a `Spacing` object once and threads it through every phase.

`LayoutMetrics` are renderer-supplied (all optional):

- `portLabelOuterReach` — actual reach of the renderer's port-label boxes. Drives the internal node/layer/root gaps.
- `fontEmSize` — base font em-size. Drives `labelClearance` (= em × 2/3) and the default subgraph label-band height.
- `subgraphLabelHeight` — pre-measured label band height; overrides em-based derivation.

Without metrics, the engine falls back to historical defaults (em = 12, port-label reach from the core `PORT_LABEL_OUTER_REACH` constant). The four spacing fields on `FlatTreeLayoutOptions` (`nodeGap`, `layerGap`, `subgraphPadding`, `subgraphLabelHeight`) always win over the derivation.

## See also

- `./spacing.ts` — single source of truth for every spacing value
- `./constants.ts` — `DEFAULT_NODE_SIZE` only; everything else moved to `spacing.ts`
- `./types.ts` — shared internal types
- `./engine.ts` — public facade
- `../tree-layout.ts` — the Buchheim implementation the outer tree calls
- `apps/editor/docs/design/auto-layout-redesign.md` — broader design exploration
