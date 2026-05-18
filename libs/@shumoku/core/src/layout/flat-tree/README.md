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

- **Disconnected components.** Each gets laid out from its own root. The outer bbox covers them all, but there's no explicit "compact packing" pass.

- **Heuristic re-balancing.** No multi-start search, no simulated annealing, no quality-function-driven re-layout. The deterministic output is good enough on typical network fixtures; making it better requires either (a) explicit user intent on individual nodes or (b) accepting non-determinism.

## See also

- `./types.ts` — shared internal types
- `./constants.ts` — gap derivations from `PORT_LABEL_OUTER_REACH`
- `../tree-layout.ts` — the Buchheim implementation the outer tree calls
- `apps/editor/docs/design/auto-layout-redesign.md` — broader design exploration
