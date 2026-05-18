// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout quality metrics.
 *
 * Pure functions that score one `FlatTreeLayoutResult` against the
 * `NetworkGraph` it came from. Used by the layout harness
 * (`./harness.ts`) to evaluate algorithm changes with numbers
 * instead of visual anecdotes.
 *
 * The metrics are deliberately simple and composable:
 *
 *   edgeLength       — total / mean / max edge run, proxies for
 *                      "are wires kept short?"
 *   rootArea         — bbox area, proxies for "canvas density"
 *   aspectRatio      — width / height, proxies for "does it fit a
 *                      typical screen?"
 *   edgeCrossings    — pairwise segment intersection count, proxy
 *                      for "is it readable?"
 *   hullOverlap      — sum of pairwise subgraph hull overlap areas;
 *                      should always be zero for the engine's
 *                      non-overlap invariant, useful as a guard
 *   stabilityScore   — RMS node displacement between two layouts
 *                      (same node-set), used to evaluate
 *                      incremental-stability work
 *
 * All metrics consume the result + the graph; none of them touch
 * the engine internals, so they double as a sanity check that
 * the engine's output is well-formed.
 */

import type { Bounds, Link, NetworkGraph } from '../../models/types.js'
import type { FlatTreeLayoutResult, Position } from '../flat-tree/types.js'

// ─────────────────────────────────────────────────────────────────────
// Edge length
// ─────────────────────────────────────────────────────────────────────

export interface EdgeLengthMetrics {
  total: number
  mean: number
  max: number
  count: number
}

/**
 * Sum / mean / max of straight-line edge length in SVG units.
 * Skips edges whose endpoints aren't in `nodePositions`.
 */
export function edgeLength(
  graph: NetworkGraph,
  nodePositions: Map<string, Position>,
): EdgeLengthMetrics {
  let total = 0
  let max = 0
  let count = 0
  for (const link of graph.links) {
    const a = nodePositions.get(link.from.node)
    const b = nodePositions.get(link.to.node)
    if (!a || !b) continue
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    total += d
    if (d > max) max = d
    count++
  }
  return { total, mean: count > 0 ? total / count : 0, max, count }
}

// ─────────────────────────────────────────────────────────────────────
// Bounding box shape
// ─────────────────────────────────────────────────────────────────────

/** Area of the root bbox in square SVG units. */
export function rootArea(bounds: Bounds): number {
  return Math.max(0, bounds.width) * Math.max(0, bounds.height)
}

/**
 * Width / height ratio. 1.0 = square; > 1 = landscape; < 1 =
 * portrait. Returns 0 when height is 0 (degenerate).
 */
export function aspectRatio(bounds: Bounds): number {
  return bounds.height > 0 ? bounds.width / bounds.height : 0
}

// ─────────────────────────────────────────────────────────────────────
// Edge crossings
// ─────────────────────────────────────────────────────────────────────

/**
 * Number of pairs of edges whose straight-line segments cross
 * (proper intersection — shared endpoints don't count).
 *
 * Brute-force O(L²) — only suitable for diagnostic / regression
 * use, not in the hot layout loop. Skips edges with missing
 * endpoints and ignores self-loops.
 *
 * Treats overlay (redundancy) and primary edges as equal weight.
 * Use {@link edgeCrossingsByKind} when you need to distinguish.
 */
export function edgeCrossings(graph: NetworkGraph, nodePositions: Map<string, Position>): number {
  const segs = collectSegments(graph, nodePositions)
  let n = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]
      const b = segs[j]
      if (a && b && segmentsCross(a, b)) n++
    }
  }
  return n
}

/**
 * Crossings split by edge kind. Overlay = `link.redundancy` set;
 * primary = everything else. The split matters because the
 * engine's overlay-aware reorder (issue #X) targets overlay
 * crossings without disturbing primary structure.
 */
export function edgeCrossingsByKind(
  graph: NetworkGraph,
  nodePositions: Map<string, Position>,
): { primary: number; overlay: number; total: number } {
  const primaryIdx: number[] = []
  const overlayIdx: number[] = []
  const segs = collectSegments(graph, nodePositions, (link, i) => {
    if (link.redundancy) overlayIdx.push(i)
    else primaryIdx.push(i)
  })
  let primary = 0
  let overlay = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i]
      const b = segs[j]
      if (!a || !b || !segmentsCross(a, b)) continue
      const aIsOverlay = overlayIdx.includes(i)
      const bIsOverlay = overlayIdx.includes(j)
      if (aIsOverlay || bIsOverlay) overlay++
      else primary++
    }
  }
  return { primary, overlay, total: primary + overlay }
}

interface Segment {
  ax: number
  ay: number
  bx: number
  by: number
  /** Endpoint node ids — used to ignore "crossings" that just share an endpoint. */
  endpoints: [string, string]
}

function collectSegments(
  graph: NetworkGraph,
  nodePositions: Map<string, Position>,
  onLink?: (link: Link, segIndex: number) => void,
): Segment[] {
  const segs: Segment[] = []
  for (const link of graph.links) {
    if (link.from.node === link.to.node) continue
    const a = nodePositions.get(link.from.node)
    const b = nodePositions.get(link.to.node)
    if (!a || !b) continue
    onLink?.(link, segs.length)
    segs.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      endpoints: [link.from.node, link.to.node],
    })
  }
  return segs
}

/**
 * Proper segment intersection: the two segments share a point
 * strictly inside both. Shared endpoints (common node) don't
 * count as a crossing — those are unavoidable in graph drawings.
 */
function segmentsCross(s1: Segment, s2: Segment): boolean {
  // Shared endpoint → not a crossing.
  for (const e of s1.endpoints) {
    if (s2.endpoints.includes(e)) return false
  }
  const d1 = direction(s2.ax, s2.ay, s2.bx, s2.by, s1.ax, s1.ay)
  const d2 = direction(s2.ax, s2.ay, s2.bx, s2.by, s1.bx, s1.by)
  const d3 = direction(s1.ax, s1.ay, s1.bx, s1.by, s2.ax, s2.ay)
  const d4 = direction(s1.ax, s1.ay, s1.bx, s1.by, s2.bx, s2.by)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  // Colinear cases: treat as non-crossing (segments overlap but
  // don't "cross"). Network diagrams with truly colinear edges
  // are extremely rare and the layout aims to avoid them
  // upstream.
  return false
}

function direction(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax)
}

// ─────────────────────────────────────────────────────────────────────
// Hull overlap
// ─────────────────────────────────────────────────────────────────────

/**
 * Sum of pairwise axis-aligned-rect overlap areas across all
 * subgraph hulls. The engine's invariant is non-overlap for
 * sibling hulls (nested ones are expected to be contained); a
 * non-zero value here flags a layout bug.
 *
 * Note: this includes nested hulls' "overlap" (an inner hull
 * fully inside its outer). Use {@link siblingHullOverlap} when
 * you only want to measure flat sibling overlap.
 */
export function hullOverlap(subgraphBounds: Map<string, Bounds>): number {
  const bs = [...subgraphBounds.values()]
  let total = 0
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]
      const b = bs[j]
      if (a && b) total += rectOverlapArea(a, b)
    }
  }
  return total
}

/**
 * Sum of pairwise overlap area across only *sibling* subgraphs
 * (i.e. ignore parent/child nesting). Caller passes the subgraph
 * parent map.
 */
export function siblingHullOverlap(
  subgraphBounds: Map<string, Bounds>,
  subgraphParents: ReadonlyMap<string, string | undefined>,
): number {
  const entries = [...subgraphBounds.entries()]
  let total = 0
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const ei = entries[i]
      const ej = entries[j]
      if (!ei || !ej) continue
      const [ai, ab] = ei
      const [bi, bb] = ej
      if (areNested(ai, bi, subgraphParents)) continue
      total += rectOverlapArea(ab, bb)
    }
  }
  return total
}

function areNested(
  a: string,
  b: string,
  parents: ReadonlyMap<string, string | undefined>,
): boolean {
  // Walk a's ancestry; if b is found, nested.
  let cur: string | undefined = parents.get(a)
  while (cur !== undefined) {
    if (cur === b) return true
    cur = parents.get(cur)
  }
  cur = parents.get(b)
  while (cur !== undefined) {
    if (cur === a) return true
    cur = parents.get(cur)
  }
  return false
}

function rectOverlapArea(a: Bounds, b: Bounds): number {
  const ox = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const oy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return ox * oy
}

// ─────────────────────────────────────────────────────────────────────
// Stability
// ─────────────────────────────────────────────────────────────────────

/**
 * RMS displacement of nodes between two layouts of the same
 * node set. Used to score how much a small structural edit
 * disturbs the rest of the diagram (the smaller, the more
 * "incremental" the engine's behaviour).
 *
 * Nodes present in only one of the two layouts are ignored.
 * Returns 0 when there are no nodes in common.
 */
export function stabilityScore(
  before: Map<string, Position>,
  after: Map<string, Position>,
): number {
  let sumSq = 0
  let n = 0
  for (const [id, a] of before) {
    const b = after.get(id)
    if (!b) continue
    sumSq += (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    n++
  }
  return n > 0 ? Math.sqrt(sumSq / n) : 0
}

// ─────────────────────────────────────────────────────────────────────
// One-shot summary
// ─────────────────────────────────────────────────────────────────────

export interface QualityReport {
  edgeLength: EdgeLengthMetrics
  rootArea: number
  aspectRatio: number
  crossings: { primary: number; overlay: number; total: number }
  hullOverlap: number
  siblingHullOverlap: number
}

/**
 * Convenience: compute every metric in one pass. The harness
 * uses this; tests may prefer the individual functions when
 * focusing on a specific signal.
 */
export function summarize(graph: NetworkGraph, result: FlatTreeLayoutResult): QualityReport {
  const subgraphParents = new Map<string, string | undefined>()
  for (const s of graph.subgraphs ?? []) subgraphParents.set(s.id, s.parent)
  return {
    edgeLength: edgeLength(graph, result.nodePositions),
    rootArea: rootArea(result.rootBounds),
    aspectRatio: aspectRatio(result.rootBounds),
    crossings: edgeCrossingsByKind(graph, result.nodePositions),
    hullOverlap: hullOverlap(result.subgraphBounds),
    siblingHullOverlap: siblingHullOverlap(result.subgraphBounds, subgraphParents),
  }
}
