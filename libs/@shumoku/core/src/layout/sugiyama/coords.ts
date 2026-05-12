// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Coordinate assignment for Sugiyama-style layered layout.
 *
 * Given ordered layers (after crossing reduction) and per-node sizes,
 * compute absolute (x, y) for every node.
 *
 * The y axis is the easy part: stack layers along the secondary axis
 * with `layerGap` spacing, each layer's thickness matching its
 * tallest node.
 *
 * The x axis uses **Brandes-Köpf 4-alignment** (the textbook algorithm
 * also used by dagre / ELK Layered / graphviz). The earlier hand-
 * rolled 2-pass average only computed `up-left` + `up-right`
 * alignments and averaged them, which meant a node's preferred x was
 * only ever derived from its parents in the layer above. For mostly-
 * tree network topology DAGs that produces a "narrow stalk above,
 * wide canopy below" layout where parents stay clustered while leaves
 * fan out, leaving every parent off-centre from its own subtree. The
 * full BK additionally runs `down-left` + `down-right` alignments
 * that align each node toward the median of its **successors** in the
 * layer below, and the median-of-4 balance recovers symmetry.
 *
 * Pipeline:
 *
 *   1. (Optional) mark type-1 / type-2 edge-segment conflicts.
 *      Standard Sugiyama subdivides long edges into dummy nodes;
 *      type-1 conflicts are non-inner segments crossing inner (dummy-
 *      dummy) segments. We don't currently insert dummies — every
 *      edge spans exactly one layer pair — so the conflicts set is
 *      always empty. The plumbing is kept so a future dummy-node
 *      phase can wire it up without restructuring this file.
 *
 *   2. For each of 4 alignments `{up, down} × {left, right}`:
 *      a. **Vertical alignment** — build "blocks" of nodes that want
 *         to share an x coordinate. Walking each layer in the
 *         configured horizontal direction, each node tries to align
 *         with its **median neighbour** (predecessor for `up`,
 *         successor for `down`). The `prevIdx` guard refuses any
 *         alignment that would cross an earlier-in-layer alignment,
 *         preventing tangled blocks.
 *      b. **Horizontal compaction** — solve for each block's x given
 *         minimum-separation constraints, by building a block-graph
 *         (blocks as nodes, in-layer adjacency as constraint edges)
 *         and running a two-sweep relaxation: first sweep pushes
 *         blocks as far left as possible, second sweep relaxes each
 *         block as far right as its downstream blocks allow. This is
 *         the dagre-style compaction that sidesteps the two flaws in
 *         the original BK paper's `sink/shift` scheme (one well-
 *         known, one documented only in the 2020 erratum
 *         arXiv:2008.01252).
 *
 *   3. **Width-minimum selection** — pick the alignment with the
 *      smallest total drawing width (max-x − min-x including half
 *      node widths) as the reference layout.
 *
 *   4. **Shift to the reference** — translate each non-reference
 *      alignment so its left edge (for `*l` alignments) or right
 *      edge (for `*r` alignments) lines up with the reference. This
 *      keeps the four candidates comparable when balancing.
 *
 *   5. **Median-balanced output** — for every node, sort its four
 *      candidate x's and emit the **average of the middle two**. The
 *      extreme alignments cancel out and a node ends up between its
 *      "as-far-left-as-possible from parents" and "as-far-right-as-
 *      possible from children" positions.
 *
 * Direction handling rotates the output after the TB computation —
 * keeps the core algorithm as a single implementation.
 *
 * **Centred fallback (no edges supplied).** Callers that skip the
 * `edges` option get a simple centred layout per layer. Used by
 * unit tests that exercise `assignCoordinates` in isolation and as
 * a safe default when the graph topology isn't available.
 *
 * **Hints.** A node with an explicit hint in `options.hints` keeps
 * its hinted x as the final value — applied after the BK balance —
 * so callers can pin individual nodes without disabling layout for
 * the rest of the graph.
 */

import type { Direction, Position, Size } from '../../models/types.js'
import type { Edge, LayerAssignment, NodeId } from './types.js'

export interface AssignCoordinatesOptions {
  /** Gap between adjacent layers. */
  layerGap?: number
  /** Gap between sibling nodes in the same layer. */
  nodeGap?: number
  /** Per-node sizes. Missing entries fall back to `defaultSize`. */
  sizes?: Map<NodeId, Size>
  /** Fallback size when `sizes` is absent or lacks an entry. */
  defaultSize?: Size
  /** Which way the edges flow. Defaults to TB. */
  direction?: Direction
  /**
   * Edges between nodes in the layered graph. When supplied, BK
   * 4-alignment runs over them. When absent, every layer is laid out
   * centred (no parent / child awareness).
   */
  edges?: Edge[]
  /**
   * Hard per-node x hints. When a node has an entry, BK still runs
   * normally but the final emitted x is replaced by the hint. Useful
   * for pinning a small subset of nodes while leaving the rest to
   * layout. The `y` field is **ignored**: layer assignment owns the
   * secondary axis.
   */
  hints?: Map<NodeId, { x: number }>
}

/**
 * Compute absolute centre positions for every node in the layer
 * assignment. The returned map is keyed by NodeId and independent
 * of the input (safe to mutate).
 */
export function assignCoordinates(
  layerAssignment: LayerAssignment,
  options: AssignCoordinatesOptions = {},
): Map<NodeId, Position> {
  const layerGap = options.layerGap ?? 60
  const nodeGap = options.nodeGap ?? 40
  const sizes = options.sizes ?? new Map<NodeId, Size>()
  const defaultSize = options.defaultSize ?? { width: 160, height: 60 }
  const direction: Direction = options.direction ?? 'TB'
  const sizeOf = (n: NodeId): Size => sizes.get(n) ?? defaultSize

  // Layer y up front so the x pass doesn't need to recompute it.
  const layerYCenter: number[] = []
  let yCursor = 0
  for (const layer of layerAssignment.layers) {
    const layerHeight = layer.reduce((h, n) => Math.max(h, sizeOf(n).height), 0)
    layerYCenter.push(yCursor + layerHeight / 2)
    yCursor += layerHeight + layerGap
  }

  // x coordinates per node.
  let xByNode: Map<NodeId, number>
  if (!options.edges || options.edges.length === 0) {
    xByNode = centredAllLayers(layerAssignment.layers, sizeOf, nodeGap)
  } else {
    xByNode = brandesKopf(layerAssignment, options.edges, sizeOf, nodeGap)
  }

  // Apply hard hints. The hint wins regardless of what BK produced
  // — callers asking for a hint are explicitly overriding layout.
  if (options.hints) {
    for (const [id, hint] of options.hints) {
      xByNode.set(id, hint.x)
    }
  }

  const tbPositions = new Map<NodeId, Position>()
  for (const [i, layer] of layerAssignment.layers.entries()) {
    const y = layerYCenter[i] ?? 0
    for (const n of layer) tbPositions.set(n, { x: xByNode.get(n) ?? 0, y })
  }

  if (direction === 'TB') return tbPositions

  // Rotate / flip into the requested orientation.
  const result = new Map<NodeId, Position>()
  for (const [id, { x, y }] of tbPositions) {
    switch (direction) {
      case 'BT':
        result.set(id, { x, y: -y })
        break
      case 'LR':
        result.set(id, { x: y, y: x })
        break
      case 'RL':
        result.set(id, { x: -y, y: x })
        break
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Fallback: no-edges layout. Lay each layer out left-to-right and shift so
// its span is centred on x = 0. Used by tests that don't supply edges and as
// a safe default when topology isn't available.
// ---------------------------------------------------------------------------

function centredAllLayers(
  layers: NodeId[][],
  sizeOf: (n: NodeId) => Size,
  nodeGap: number,
): Map<NodeId, number> {
  const out = new Map<NodeId, number>()
  for (const layer of layers) {
    const xs: number[] = []
    let xCursor = 0
    for (const n of layer) {
      const { width } = sizeOf(n)
      xs.push(xCursor + width / 2)
      xCursor += width + nodeGap
    }
    const span = layer.length === 0 ? 0 : xCursor - nodeGap
    const shiftX = -span / 2
    for (const [j, n] of layer.entries()) out.set(n, (xs[j] ?? 0) + shiftX)
  }
  return out
}

// ---------------------------------------------------------------------------
// Brandes-Köpf 4-alignment.
// ---------------------------------------------------------------------------

/**
 * Returned by `verticalAlignment`. For each node v:
 *   - `root[v]` = the block root v belongs to (a representative node id)
 *   - `align[v]` = the next node in the block's circular alignment list
 * The block-membership graph forms one cycle per block when you
 * follow `align`; the root has the lowest "preferred" index in the
 * walked direction.
 */
interface AlignmentResult {
  root: Map<NodeId, NodeId>
  align: Map<NodeId, NodeId>
}

type Conflicts = Map<NodeId, Set<NodeId>>
type AlignmentKey = 'ul' | 'ur' | 'dl' | 'dr'

function brandesKopf(
  layerAssignment: LayerAssignment,
  edges: Edge[],
  sizeOf: (n: NodeId) => Size,
  nodeGap: number,
): Map<NodeId, number> {
  const layers = layerAssignment.layers
  if (layers.length === 0) return new Map()

  // Adjacency. We treat the layered graph as a DAG flowing source → target
  // and read predecessors / successors directly off the edge list.
  const preds = new Map<NodeId, NodeId[]>()
  const succs = new Map<NodeId, NodeId[]>()
  for (const e of edges) {
    if (e.source === e.target) continue
    const pl = preds.get(e.target)
    if (pl) pl.push(e.source)
    else preds.set(e.target, [e.source])
    const sl = succs.get(e.source)
    if (sl) sl.push(e.target)
    else succs.set(e.source, [e.target])
  }

  // Conflict map. Empty for now — we don't subdivide long edges so
  // there are no inner segments to mark. The plumbing is here so a
  // future dummy-node phase can populate it without restructuring.
  const conflicts: Conflicts = new Map()

  const xss: Record<AlignmentKey, Map<NodeId, number>> = {
    ul: new Map(),
    ur: new Map(),
    dl: new Map(),
    dr: new Map(),
  }

  for (const vert of ['u', 'd'] as const) {
    // For `d` alignments, reverse the layer order so the walk goes
    // bottom → top; `verticalAlignment` still iterates "first layer
    // first", which corresponds to leaves first in this orientation.
    const vertLayers = vert === 'u' ? layers : [...layers].reverse()
    const neighborFn = (v: NodeId): NodeId[] => (vert === 'u' ? preds.get(v) : succs.get(v)) ?? []

    for (const horiz of ['l', 'r'] as const) {
      // For `r` alignments, reverse within-layer order so the walk
      // goes right → left; combined with sign-flip after compaction
      // this produces a right-anchored layout.
      const oriented = horiz === 'l' ? vertLayers : vertLayers.map((layer) => [...layer].reverse())

      const alignment = verticalAlignment(oriented, neighborFn, conflicts)
      const xs = horizontalCompaction(oriented, alignment, sizeOf, nodeGap)
      if (horiz === 'r') {
        for (const [k, v] of xs) xs.set(k, -v)
      }
      xss[(vert + horiz) as AlignmentKey] = xs
    }
  }

  const reference = findSmallestWidthAlignment(xss, sizeOf)
  alignCoordinates(xss, reference)
  return balance(xss)
}

/**
 * Build vertical alignment blocks. For each layer (in the supplied
 * walking direction), each node tries to align with its median
 * neighbour in the previously-processed adjacent layer, subject to:
 *   - the node hasn't already been claimed by an earlier-in-layer
 *     neighbour (`align[v] === v` check),
 *   - aligning here wouldn't cross an earlier alignment in this
 *     layer (`prevIdx < posW`),
 *   - the edge is not marked as a type-1 conflict.
 */
function verticalAlignment(
  layers: NodeId[][],
  neighborFn: (v: NodeId) => NodeId[],
  conflicts: Conflicts,
): AlignmentResult {
  const root = new Map<NodeId, NodeId>()
  const align = new Map<NodeId, NodeId>()
  const pos = new Map<NodeId, number>()

  // Initialise blocks: each node starts as its own root, aligned to
  // itself, with a position equal to its index in the current layer
  // (which encodes both the horizontal reversal and the in-layer
  // ordering produced by crossing reduction).
  for (const layer of layers) {
    for (const [order, v] of layer.entries()) {
      root.set(v, v)
      align.set(v, v)
      pos.set(v, order)
    }
  }

  for (const layer of layers) {
    let prevIdx = -1
    for (const v of layer) {
      const neighbours = neighborFn(v)
      if (neighbours.length === 0) continue
      // Sort neighbours by their position in the adjacent layer so
      // the median lookup uses in-layer order.
      const ws = neighbours.slice().sort((a, b) => (pos.get(a) ?? 0) - (pos.get(b) ?? 0))
      const mp = (ws.length - 1) / 2
      for (let i = Math.floor(mp); i <= Math.ceil(mp); i++) {
        const w = ws[i]
        if (w === undefined) continue
        if (align.get(v) !== v) continue // already claimed by an earlier node
        const posW = pos.get(w) ?? 0
        if (prevIdx >= posW) continue // would cross an earlier alignment
        if (hasConflict(conflicts, v, w)) continue
        // Insert v into the block w belongs to. `align` forms a
        // ring: w → ... → root → ... → w, and inserting v before w's
        // successor sets w.align = v and v.align = root[w].
        const rootW = root.get(w)
        if (rootW === undefined) continue
        align.set(w, v)
        align.set(v, rootW)
        root.set(v, rootW)
        prevIdx = posW
      }
    }
  }

  return { root, align }
}

/**
 * Solve x coordinates given the block decomposition. We model the
 * non-overlap constraints as a block-graph: each block is a node,
 * each adjacent (left, right) pair in a layer contributes an edge
 * (root(left) → root(right)) with weight = the minimum gap that
 * pair needs.
 *
 * Two passes:
 *
 *   1. Sweep predecessors → successors, assigning each block the
 *      smallest x that satisfies all incoming constraints. (Pushes
 *      everything as far left as possible.)
 *   2. Sweep successors → predecessors. For each block, check the
 *      tightest constraint from a downstream block; if there's room
 *      between the current x and that bound, slide right. This
 *      removes spurious gaps the first sweep introduced.
 *
 * Block roots get the final x. Every other node in a block inherits
 * its root's x — that's what makes the block visually vertical.
 */
function horizontalCompaction(
  layers: NodeId[][],
  alignment: AlignmentResult,
  sizeOf: (n: NodeId) => Size,
  nodeGap: number,
): Map<NodeId, number> {
  const { root, align } = alignment

  /** For each block root b, list of (left-neighbour-root, weight). */
  const blockIn = new Map<NodeId, { u: NodeId; w: number }[]>()
  /** For each block root b, list of (right-neighbour-root, weight). */
  const blockOut = new Map<NodeId, { v: NodeId; w: number }[]>()
  const blockNodes = new Set<NodeId>()

  const sepBetween = (left: NodeId, right: NodeId): number =>
    sizeOf(left).width / 2 + sizeOf(right).width / 2 + nodeGap

  for (const layer of layers) {
    let prev: NodeId | undefined
    for (const v of layer) {
      const vRoot = root.get(v) ?? v
      blockNodes.add(vRoot)
      if (prev !== undefined) {
        const prevRoot = root.get(prev) ?? prev
        const w = sepBetween(prev, v)
        // Merge with existing constraint if any — two pairs that
        // happen to span the same block boundary keep the max.
        const inList = blockIn.get(vRoot) ?? []
        const existing = inList.find((e) => e.u === prevRoot)
        if (existing) {
          existing.w = Math.max(existing.w, w)
        } else {
          inList.push({ u: prevRoot, w })
          blockIn.set(vRoot, inList)
        }
        const outList = blockOut.get(prevRoot) ?? []
        const existingOut = outList.find((e) => e.v === vRoot)
        if (existingOut) {
          existingOut.w = Math.max(existingOut.w, w)
        } else {
          outList.push({ v: vRoot, w })
          blockOut.set(prevRoot, outList)
        }
      }
      prev = v
    }
  }

  // Pass 1: tight-left. Visit each block after all its predecessors
  // (DFS post-order over the block-graph). Each block's x is the max
  // over incoming edges of (predecessor x + weight).
  const xsBlock = new Map<NodeId, number>()
  const visited1 = new Set<NodeId>()
  const stack: NodeId[] = [...blockNodes]
  while (stack.length > 0) {
    const top = stack[stack.length - 1]
    if (top === undefined) {
      stack.pop()
      continue
    }
    if (visited1.has(top)) {
      stack.pop()
      const incoming = blockIn.get(top) ?? []
      let best = 0
      for (const { u, w } of incoming) {
        best = Math.max(best, (xsBlock.get(u) ?? 0) + w)
      }
      xsBlock.set(top, best)
    } else {
      visited1.add(top)
      const incoming = blockIn.get(top) ?? []
      for (const { u } of incoming) {
        if (!visited1.has(u)) stack.push(u)
      }
    }
  }

  // Pass 2: slack-right. Visit each block after all its successors
  // (post-order over reversed block-graph). Slide each block right as
  // far as its downstream-most constraint allows.
  const visited2 = new Set<NodeId>()
  const stack2: NodeId[] = [...blockNodes]
  while (stack2.length > 0) {
    const top = stack2[stack2.length - 1]
    if (top === undefined) {
      stack2.pop()
      continue
    }
    if (visited2.has(top)) {
      stack2.pop()
      const outgoing = blockOut.get(top) ?? []
      let bound = Number.POSITIVE_INFINITY
      for (const { v, w } of outgoing) {
        const xv = xsBlock.get(v)
        if (xv !== undefined) bound = Math.min(bound, xv - w)
      }
      if (bound !== Number.POSITIVE_INFINITY) {
        xsBlock.set(top, Math.max(xsBlock.get(top) ?? 0, bound))
      }
    } else {
      visited2.add(top)
      const outgoing = blockOut.get(top) ?? []
      for (const { v } of outgoing) {
        if (!visited2.has(v)) stack2.push(v)
      }
    }
  }

  // Propagate root x to every aligned node.
  const xs = new Map<NodeId, number>()
  for (const v of align.keys()) {
    const vRoot = root.get(v) ?? v
    xs.set(v, xsBlock.get(vRoot) ?? 0)
  }
  return xs
}

/** Total drawing span (max right edge − min left edge) using node widths. */
function findSmallestWidthAlignment(
  xss: Record<AlignmentKey, Map<NodeId, number>>,
  sizeOf: (n: NodeId) => Size,
): Map<NodeId, number> {
  let minWidth = Number.POSITIVE_INFINITY
  let best: Map<NodeId, number> = xss.ul
  for (const xs of Object.values(xss)) {
    let max = Number.NEGATIVE_INFINITY
    let min = Number.POSITIVE_INFINITY
    for (const [v, x] of xs) {
      const hw = sizeOf(v).width / 2
      max = Math.max(max, x + hw)
      min = Math.min(min, x - hw)
    }
    const width = max - min
    if (width < minWidth) {
      minWidth = width
      best = xs
    }
  }
  return best
}

/**
 * Translate each non-reference alignment so that its left edge (for
 * `*l` alignments) or right edge (for `*r` alignments) lines up with
 * the reference alignment's corresponding edge. This makes the four
 * x candidates comparable when the median balance averages them.
 */
function alignCoordinates(
  xss: Record<AlignmentKey, Map<NodeId, number>>,
  reference: Map<NodeId, number>,
): void {
  const refVals = Array.from(reference.values())
  if (refVals.length === 0) return
  const refMin = Math.min(...refVals)
  const refMax = Math.max(...refVals)

  for (const vert of ['u', 'd'] as const) {
    for (const horiz of ['l', 'r'] as const) {
      const key = (vert + horiz) as AlignmentKey
      const xs = xss[key]
      if (xs === reference) continue
      const vals = Array.from(xs.values())
      if (vals.length === 0) continue
      const delta = horiz === 'l' ? refMin - Math.min(...vals) : refMax - Math.max(...vals)
      if (delta === 0) continue
      const shifted = new Map<NodeId, number>()
      for (const [k, v] of xs) shifted.set(k, v + delta)
      xss[key] = shifted
    }
  }
}

/** For each node, take the average of the middle two of the four x's. */
function balance(xss: Record<AlignmentKey, Map<NodeId, number>>): Map<NodeId, number> {
  const reference = xss.ul
  const out = new Map<NodeId, number>()
  for (const v of reference.keys()) {
    const all = [xss.ul.get(v), xss.ur.get(v), xss.dl.get(v), xss.dr.get(v)]
    const vals = all.filter((x): x is number => x !== undefined).sort((a, b) => a - b)
    if (vals.length === 0) {
      out.set(v, 0)
      continue
    }
    if (vals.length < 4) {
      // Shouldn't happen with our 4-alignment pipeline, but be safe.
      out.set(v, vals[Math.floor(vals.length / 2)] ?? 0)
      continue
    }
    out.set(v, ((vals[1] ?? 0) + (vals[2] ?? 0)) / 2)
  }
  return out
}

function hasConflict(conflicts: Conflicts, a: NodeId, b: NodeId): boolean {
  const [lo, hi] = a < b ? [a, b] : [b, a]
  return conflicts.get(lo)?.has(hi) ?? false
}
