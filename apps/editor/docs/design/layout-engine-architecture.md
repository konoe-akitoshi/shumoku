# Layout Engine Architecture

Status: **proposal — Codex-reviewed LGTM 2026-05-19, ready to implement**
Last updated: 2026-05-19

## Why this document exists

The current layout code in `@shumoku/core/layout` mixes three responsibilities:

1. **Spatial rules**: "how big is this node?", "how much gap must sit between these two things?", "where on a node does this port go?"
2. **Auto-placement algorithm**: parent extraction, block partition, side-chain layout, Buchheim tidy-tree, spine alignment, hull computation — the actual positioning procedure.
3. **Manual placement**: drag/drop in the editor; needs to honour the same spatial rules but doesn't run the auto algorithm.

Today (1) is scattered across `network-layout.ts`, `port-placement.ts`, `flat-tree/spacing.ts`, `flat-tree/port-extent.ts`, `core/constants.ts`, with some duplicated in renderer packages. (2) is `flat-tree/` plus an orchestrator in `network-layout.ts`. (3) is in the editor app, often duplicating its own arithmetic.

This split causes:

- Layout values diverge from rendered values (e.g. `ESTIMATED_CHAR_WIDTH * length` vs the renderer's actual font metrics).
- Manual placement doesn't pick up engine updates (e.g. tighter port-aware gap).
- It's unclear which code path "owns" a given decision.
- Tests have to construct full `NetworkGraph` objects to exercise pure spacing functions.

This document proposes the target architecture.

## Design principles

After review feedback, three principles drive the design:

1. **Small, boring policy interfaces.** Each interface answers one kind of question. A "rule object" doesn't ship a layout algorithm. A "placement policy" doesn't measure text. A "text measurer" doesn't decide port sides. Composition happens explicitly, not by piling everything onto one god-object.

2. **No semantic hidden state.** Rule queries are referentially transparent for a given config. Implementations *may* memoize; cache keys are derived from a stable `fingerprint`. Incremental-layout state (previous positions, dirty regions) belongs to algorithm/session objects, not the rule layer.

3. **Algorithm-coupled vocabulary stays in the algorithm.** "Right side / left side gap", "port-side decision", "subgraph hull" are flat-tree concepts. Lower-level primitives (obstacle rect, min-separation along an axis) belong in the rule layer; flat-tree adapts them up.

## Target architecture

```
                  ┌──────────────────────────────────────────────┐
                  │  Composed engine = LayoutRules + Placement    │
                  │  Policy + TextMeasurer + (no algorithms)      │
                  │                                              │
                  │  createEngine(config) returns a value with    │
                  │  these four faces. They are also exposed      │
                  │  individually so callers can take only what   │
                  │  they need.                                   │
                  └──────────────────────────────────────────────┘
                       ▲                                  ▲
                       │                                  │
                       │ uses rules + primitives           │ uses rules + policy
                       │                                  │
        ┌──────────────┴──────────┐          ┌────────────┴────────────┐
        │  Auto-placement         │          │  Manual placement       │
        │  (flat-tree algorithm)  │          │  (editor)               │
        │                         │          │                         │
        │  Owns:                  │          │  Owns:                  │
        │   - parent extraction   │          │   - drag UI             │
        │   - block partition     │          │   - keyboard / snap UX  │
        │   - internal layouts    │          │   - conflict feedback   │
        │   - tidy-tree call      │          │                         │
        │   - spine alignment     │          │  Calls engine for:      │
        │   - hull computation    │          │   - sizes               │
        │   - port-side decision  │          │   - placement.tryPlace  │
        │     (direction-aware)   │          │                         │
        └─────────────────────────┘          └─────────────────────────┘

        Tree primitive (Buchheim) lives privately inside
        auto-placement/flat-tree/ for now — promote it to a shared
        primitives/ module when a second algorithm wants it.
```

## Interfaces

### `LayoutRules` — spatial rule authority

```ts
interface LayoutRules {
  // Sizing
  nodeBodySize(node: Node): Size
  /**
   * Footprint including port-lane allowance. `portsBySide`
   * describes the *state of affairs* — which ports sit on
   * which side, with their labels. The rule layer reads the
   * labels via the injected TextMeasurer and sizes the box;
   * it does not decide which side each port is on.
   * Algorithm-specific port-side decisions (direction-aware,
   * device-type heuristics, …) live in the algorithm.
   */
  nodeFootprint(node: Node, ctx?: { portsBySide?: PortsBySide }): Size
  /** Axis-aligned obstacle rect for collision / gap math. */
  nodeObstacle(node: Node, pos: Position, ctx?: { portsBySide?: PortsBySide }): Rect

  // Separation
  /**
   * Minimum separation between two obstacles along an axis,
   * given any policy add-ons. Higher-level helpers
   * (port-aware gap, layer gap) compose this.
   */
  minSeparation(a: Rect, b: Rect, axis: 'x' | 'y'): number

  // Subgraph framing — config accessors
  readonly subgraphPadding: number
  readonly subgraphLabelHeight: number

  // Introspection
  readonly metrics: LayoutMetrics
  /** Stable hash of config — usable as cache key. */
  readonly fingerprint: string
}
```

Note that `direction` is **not** on `LayoutRules`. Direction (TB/BT/LR/RL) only affects two things and both are algorithm-coupled: it drives which side ports get assigned to (`decidePortSide` in flat-tree), and it triggers the final rotation pass (`rotate.ts` in flat-tree). Rules — sizes, gaps, padding — are direction-neutral by construction.

### Shared types (sketch)

```ts
type Side = 'top' | 'bottom' | 'left' | 'right'

interface Size { width: number; height: number }
interface Position { x: number; y: number }
interface Rect { x: number; y: number; width: number; height: number }

/**
 * Engine config — drives the rule layer. Direction is not
 * here: it's an algorithm option (passed to
 * `autoLayoutFlatTree`), because rules are direction-neutral.
 */
interface EngineConfig {
  metrics?: LayoutMetrics
  density?: 'compact' | 'normal' | 'comfortable'
  textMeasurer?: TextMeasurer
}

/**
 * Per-side port lists, with each port's id and optional label.
 * Richer than a count-only map so the rule layer can size each
 * side correctly when port labels have very different widths
 * (e.g. `Gi1/0/1` on top, longer `40G-uplink-spare` on bottom).
 */
interface PortsBySide {
  top: PortInfo[]
  bottom: PortInfo[]
  left: PortInfo[]
  right: PortInfo[]
}
interface PortInfo {
  id: string
  label?: string
}

/** Placement-policy result for one tryPlace call. */
interface PlacementResult {
  valid: boolean
  requested: Position
  snapped: Position
  footprint: Rect
  conflicts: PlacementConflict[] // empty when valid
}
interface PlacementConflict {
  withNodeId: string
  overlap: Rect
}

/** An occupant of the canvas — what `tryPlace` checks against. */
interface NodeWithPosition {
  id: string
  position: Position
  footprint: Rect
}
```

### Boundary: what's public vs flat-tree-internal

| Concept | Where | Why |
|---|---|---|
| `PortsBySide` (per-side port lists with labels) | **`LayoutRules` public** | A neutral *state-of-affairs* type. Every layout algorithm that draws ports on sides needs to express "this node has these ports on these sides" — even force-directed. The rule layer reads it to size obstacles via the TextMeasurer; it does not decide its content. |
| `decidePortSide(link, role)` | flat-tree | The *decision* of which side a port lives on is algorithm-coupled: it depends on layout direction, parent/child role, and shumoku's device-type heuristics. A force-directed layout would decide differently. |
| `SideExtent` ("does this side have a port?") | flat-tree | A derived view used by flat-tree's *facing-side* gap calculation. The "facing side" framing is itself algorithm-coupled (it presumes tree-like sibling adjacency). |
| `gap(right, left)` (port-aware facing-side gap) | flat-tree | Flat-tree-specific adapter that consumes `SideExtent` and emits a number. Internally it calls `LayoutRules.minSeparation` on two derived rects. |

Net: the rule layer accepts `PortsBySide` as a public input but does not own the algorithm-coupled vocabulary of "right / left / facing sides".

**Implementation watchpoint**: `LayoutRules` documentation and JSDoc examples must not imply the rule layer *computes* or *normalizes* port-side assignment. It only *consumes* the per-side port lists supplied via `PortsBySide`. Anything that decides "which side this port goes on" lives in the algorithm.

### `PlacementPolicy` — manual-placement policy

```ts
interface PlacementPolicy {
  /**
   * Try to place `node` at `pos` given the current occupants.
   * Returns a structured result so the editor can show why
   * placement failed and offer the snapped alternative.
   * `PlacementResult` and `NodeWithPosition` are defined in
   * the shared types sketch above.
   */
  tryPlace(
    node: Node,
    pos: Position,
    occupants: Iterable<NodeWithPosition>,
  ): PlacementResult

  /** Snap a position to the policy's grid / alignment. */
  snapTo(pos: Position): Position
}
```

A boolean `canPlaceAt` is insufficient — the editor needs to *show* why placement failed (which node it would collide with, where the nearest valid spot is). Defining the structured result up front avoids API churn later.

### `TextMeasurer` — text width source

```ts
interface TextMeasurer {
  /** Width in SVG units of `text` rendered at `kind`'s configured font. */
  measure(text: string, kind: 'body' | 'port' | 'subgraph'): number
}
```

Injected. The default implementation uses canvas (already in `measure-text.ts`). Renderers that have authoritative font metrics can supply their own — the SVG renderer in a browser knows the actual sub-pixel widths; the CLI renderer doesn't, and the default approximation is fine for it.

This injection seam stops `LayoutRules` from owning a measurement function that pretends to know what the renderer will do.

### `TreeLayout` — primitive, NOT an engine method

Buchheim tidy-tree is an algorithmic primitive, not a rule. It lives as a free function:

```ts
function tidyTree(
  nodes: TidyTreeNode[],
  edges: TidyTreeEdge[],
  options: { nodeGap: number; layerGap: number; nodeSize: (id: string) => Size; ... },
): TidyTreeResult
```

Auto-placement imports it directly. The rule layer doesn't vend algorithms.

For now it lives under `auto-placement/flat-tree/tidy-tree.ts` (private). When a second auto-placement algorithm wants it, promote it to `layout/primitives/tidy-tree.ts`.

### Composition

```ts
interface LayoutEngine extends LayoutRules, PlacementPolicy {
  readonly text: TextMeasurer
}

function createEngine(config?: EngineConfig): LayoutEngine
```

`createEngine` composes the three concerns for caller ergonomics. Callers who want only one face can destructure or import the underlying constructors directly.

## Package layout

```
@shumoku/core/src/layout/
  │
  ├── engine/                          ── small, boring rule layer
  │   ├── types.ts                     EngineConfig, Size, Position, Rect, Side,
  │   │                                 PortsBySide, LayoutMetrics,
  │   │                                 PlacementResult, etc.
  │   ├── rules.ts                     LayoutRules implementation
  │   ├── placement.ts                 PlacementPolicy implementation
  │   ├── text-measurer.ts             TextMeasurer (default = canvas-based)
  │   ├── spacing.ts                   gap derivation, em-based clearance
  │   ├── node-size.ts                 nodeBodySize, nodeFootprint, nodeObstacle
  │   └── index.ts                     createEngine, LayoutEngine interface
  │
  ├── auto-placement/
  │   └── flat-tree/                   one specific algorithm
  │       ├── tidy-tree.ts             Buchheim primitive (private; promote later)
  │       ├── port-side.ts             direction-aware port-side decision
  │       │                              (was in port-placement.ts)
  │       ├── port-position.ts         port absolute coords
  │       ├── port-extent.ts           "facing side" adapter — calls rules.minSeparation
  │       ├── parents.ts
  │       ├── blocks.ts
  │       ├── internal.ts
  │       ├── outer.ts
  │       ├── sort.ts
  │       ├── spine.ts
  │       ├── hulls.ts
  │       ├── rotate.ts
  │       ├── pin.ts
  │       ├── diagnostics.ts
  │       └── index.ts                 autoLayoutFlatTree(graph, engine, options)
  │
  └── index.ts                         re-exports
```

The current `network-layout.ts`, `port-placement.ts`, `measure-text.ts`, `flat-tree/*` files redistribute according to whether each piece is a rule (→ `engine/`) or an algorithm step (→ `auto-placement/flat-tree/`).

## Diagnostics

Diagnostics stay **structured first-class output**, not string logs. The existing `Diagnostic[]` shape from `flat-tree/diagnostics.ts` extends to cover:

- Rule disagreements ("layout used gap X, rules would have recommended Y")
- Placement-policy conflicts (the `conflicts: PlacementConflict[]` field)
- Algorithm decisions (existing `explain: true` codes)

Diagnostic emission is opt-in (`explain: true` on auto-placement, an explicit collector on placement).

## Coordinate conventions

Made explicit so they don't infect every API by accident:

- Origin top-left, +x right, +y down.
- All positions are **node centres**. Rect / footprint return four sides.
- `Direction` (TB/BT/LR/RL) is **only** an option to auto-placement. `LayoutRules` is direction-neutral (sizes, gaps, padding don't change with direction). Manual placement and rendering see absolute coords already in the chosen direction.
- The flat-tree algorithm computes in TB internally and rotates at the end (existing `rotate.ts`). That pipeline stays.

## Migration

One PR. Internals move freely.

Order within the PR:

1. Create `engine/` with `types.ts`, `rules.ts`, `placement.ts`, `text-measurer.ts`. Move `spacing.ts` / `measure-text.ts` in; extract `node-size.ts` from `network-layout.ts`.
2. Create `auto-placement/flat-tree/`. Move `flat-tree/*` files in; move `port-placement.ts` content in; move the orchestration loop from `network-layout.ts` to `auto-placement/flat-tree/index.ts`.
3. Rewrite the entry point: `autoLayoutFlatTree(graph, engine, options)` replaces `layoutNetwork(graph, options)`.
4. Update apps, plugins, tests.
5. Delete the old files.

External callers update at the same time:

- `apps/editor/*` — switch to `createEngine` + `autoLayoutFlatTree`. Replace manual-placement arithmetic with `engine.tryPlace` / `engine.nodeFootprint`.
- `apps/cli`, `apps/server`, `apps/docs` — switch entry call.
- `libs/@shumoku/renderer-svg`, `renderer-html`, `renderer-png` — consume layout results unchanged. Optionally adopt `engine.text.measure(text, 'port')` to replace `SMALL_LABEL_CHAR_WIDTH * length` in port-label background rect calculation.

### Snapshot tests

The refactor aims to be value-preserving: same engine config → same numbers. Snapshots should not move. If they do (e.g. because `network-layout.ts`'s implicit defaults changed when extracted into the engine), the diff is re-recorded with a note.

## Behavioral contract tests

In addition to snapshots, the engine ships **contract tests** that lock the rules independent of any algorithm:

- "node with a single bottom port has bottom > 0 in `nodeFootprint`'s implied ports map"
- "`minSeparation(a, b, 'x')` is symmetric in arguments"
- "`tryPlace` returns `valid=false` when placement overlaps an existing node by ≥1 pixel"
- "`measure(text, kind)` is monotonic in `text.length` for the same kind"
- ...

These outlive the algorithm — if we replace flat-tree with a different layout one day, the engine contract tests still apply.

## Performance / batching

Per-node queries are fine ergonomically. For the editor's drag loop and auto-placement's tight inner loops:

- Implementations may memoize internally. `LayoutRules.fingerprint` is the cache key.
- An optional `measureGraph(graph)` batch helper pre-computes node footprints + max port-label widths in one pass and returns a lookup. Auto-placement uses it; manual placement doesn't need it.

Don't optimize prematurely; revisit if profiling shows drag-loop work over a few ms.

## Pinned / manual positions: revalidation policy

When the rules change (e.g. user switches density preset), existing pinned positions may violate new constraints. Policy:

- Pinned positions remain pinned (user intent wins).
- The engine emits a `pinned-violates-rules` diagnostic when a pinned position fails `tryPlace` under the new rules.
- The auto-placement algorithm respects pins regardless; the editor surfaces the diagnostic so the user can choose to re-snap.

This avoids silent "your layout looks worse because we changed a constant" surprises.

## What this enables next

Listed in expected order of usefulness; not part of this PR.

1. **Manual placement consumes the engine** in the editor. Drag handlers call `tryPlace`; selection-resize uses `nodeFootprint`. One source of truth for both paths.

2. **Renderer label widths use `engine.text.measure`** instead of `SMALL_LABEL_CHAR_WIDTH * length`. No more layout/rendered divergence.

3. **A second auto-placement algorithm** becomes feasible (e.g. a hand-tuned "rack diagram" mode). Lives next to flat-tree, consumes the same rules.

4. **Engine contract tests** outlive any single algorithm. Replacing flat-tree later doesn't require re-asserting the spacing model.

5. **Diagnostics drive layout debugging**: when a snapshot looks wrong, the engine reports which rule was at play.

## Open questions (post-review)

- **Density preset** (`compact|normal|comfortable`) — left for follow-up. Default to `normal`.
- **`TextMeasurer` injection point**: should `createEngine` accept a `textMeasurer?` option? Probably yes; the default is the canvas-based one.
- **`fingerprint` shape**: a stable hash string (e.g. SHA of canonical config JSON) is enough for cache keys. Implementation detail; settle in PR.
- **Promoting `tidy-tree` to `primitives/`**: defer until a second algorithm needs it.

## Non-goals

- Replacing the flat-tree algorithm. This is a structural refactor.
- Changing visual output materially. Same engine config → same positions.
- Building a third-party plugin system. The engine isn't a general layout SDK.
- Re-architecting wire routing. Routing stays a separate post-layout pass.
