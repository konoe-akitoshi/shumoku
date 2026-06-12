// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Layout invariant checks (engine-v3-migration.md P0, #430).
 *
 * During the v3 prototype rounds, every visual defect the user spotted by
 * eye ("thunder-1 sticks out of its box", "qfx5120 and nexus overlap")
 * turned out to be a layout pass violating an invariant that nothing was
 * checking. Lesson recorded in engine-v3-design.md §30-31: each new
 * placement pass can silently break containment / overlap / track
 * separation, so the checks must be a standing fixture — vitest in CI and
 * cheap enough to assert in dev builds.
 *
 * Three invariants, all pure-geometry and engine-agnostic:
 *   1. Node boxes never overlap.
 *   2. A node stays inside its container's bounds (subgraph membership).
 *   3. No two edge segments run collinear on the same track (parallel
 *      within a small gap AND sharing more than a token length). Distinct
 *      strands/lanes are separated by design, so any near-zero-gap pair is
 *      a routing bug, not a style.
 *
 * `checkLayoutInvariants` adapts a ResolvedLayout; the `find*` functions
 * are pure and unit-testable without an engine.
 */

import type { Bounds, Position } from '../models/types.js'
import { resolveNodeSize } from './engine/index.js'
import { portBox, portLabelBox } from './port-geometry.js'
import type { ResolvedLayout, ResolvedPort } from './resolved-types.js'
import { BBoxGrid } from './spatial-grid.js'

// ============================================================================
// Pure geometry inputs
// ============================================================================

/** Axis-aligned node box, position = CENTER (renderer semantics). */
export interface BoxSpec {
  id: string
  x: number
  y: number
  width: number
  height: number
}

/** A container (subgraph/zone box) and the node ids it must enclose. */
export interface ContainerSpec {
  id: string
  bounds: Bounds
  memberIds: readonly string[]
}

/** An edge centerline as a polyline, with optional stroke half-width. */
export interface PolylineSpec {
  id: string
  points: readonly Position[]
  /** Half of the drawn stroke (or strand-bundle) width. Default 1. */
  halfWidth?: number
}

// ============================================================================
// 1. Node overlap
// ============================================================================

export interface NodeOverlap {
  a: string
  b: string
  /** Penetration depth along x/y (both > 0 when overlapping). */
  overlapX: number
  overlapY: number
}

/**
 * Find pairs of node boxes that overlap (optionally requiring `margin`
 * clear space between boxes). O(n²) — layout-sized inputs only.
 */
export function findNodeOverlaps(boxes: readonly BoxSpec[], margin = 0): NodeOverlap[] {
  const out: NodeOverlap[] = []
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    if (!a) continue
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (!b) continue
      const overlapX = (a.width + b.width) / 2 + margin - Math.abs(a.x - b.x)
      const overlapY = (a.height + b.height) / 2 + margin - Math.abs(a.y - b.y)
      if (overlapX > 0 && overlapY > 0) out.push({ a: a.id, b: b.id, overlapX, overlapY })
    }
  }
  return out
}

// ============================================================================
// 2. Containment
// ============================================================================

export interface ContainmentViolation {
  nodeId: string
  containerId: string
  /** How far the box protrudes beyond the container (px, > 0). */
  protrusion: number
}

/**
 * Find member nodes whose box is not fully inside their container's
 * bounds (shrunk by `pad` on each side). Unknown member ids are ignored —
 * membership resolution is the caller's concern.
 */
export function findContainmentViolations(
  boxes: readonly BoxSpec[],
  containers: readonly ContainerSpec[],
  pad = 0,
): ContainmentViolation[] {
  const byId = new Map<string, BoxSpec>()
  for (const box of boxes) byId.set(box.id, box)
  const out: ContainmentViolation[] = []
  for (const c of containers) {
    for (const memberId of c.memberIds) {
      const box = byId.get(memberId)
      if (!box) continue
      const left = c.bounds.x + pad - (box.x - box.width / 2)
      const right = box.x + box.width / 2 - (c.bounds.x + c.bounds.width - pad)
      const top = c.bounds.y + pad - (box.y - box.height / 2)
      const bottom = box.y + box.height / 2 - (c.bounds.y + c.bounds.height - pad)
      const protrusion = Math.max(left, right, top, bottom)
      if (protrusion > 0.5) out.push({ nodeId: memberId, containerId: c.id, protrusion })
    }
  }
  return out
}

// ============================================================================
// 3. Collinear track sharing
// ============================================================================

export interface CollinearOverlap {
  a: string
  b: string
  /** Length of the shared collinear run (px). */
  sharedLength: number
}

export interface CollinearOptions {
  /** Segments shorter than this are ignored (chamfers, stubs). */
  minSegmentLength?: number
  /** Shared runs shorter than this are tolerated. */
  minSharedLength?: number
  /** Extra clearance required between strokes beyond their half-widths. */
  clearance?: number
}

/**
 * Find pairs of edges with segments that run on the same track: parallel
 * (within ~1°), closer than the sum of their half-widths + clearance, and
 * sharing more than `minSharedLength` of extent. Reports each edge pair
 * once with its longest shared run.
 */
export function findCollinearOverlaps(
  lines: readonly PolylineSpec[],
  options: CollinearOptions = {},
): CollinearOverlap[] {
  const minSeg = options.minSegmentLength ?? 13
  const minShared = options.minSharedLength ?? 12
  const clearance = options.clearance ?? 0.5

  // Segment grid: a contributing pair must be parallel within the pair gap
  // AND overlap in extent, so the two segments sit within `gap` of each
  // other — inflating every segment bbox by the LARGEST possible gap means
  // any such pair shares a cell. Far pairs the old scan visited were all
  // rejected by the gap/extent tests anyway, so the candidate sweep
  // produces identical shared-run results.
  let maxHalf = 1
  for (const l of lines) maxHalf = Math.max(maxHalf, l.halfWidth ?? 1)
  const inflate = maxHalf * 2 + clearance

  interface Seg {
    a1: Position
    a2: Position
    vax: number
    vay: number
    len: number
    line: number
  }
  const segs: Seg[] = []
  const grid = new BBoxGrid(180)
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    if (!line) continue
    for (let s = 1; s < line.points.length; s++) {
      const a1 = line.points[s - 1]
      const a2 = line.points[s]
      if (!a1 || !a2) continue
      const vax = a2.x - a1.x
      const vay = a2.y - a1.y
      const len = Math.hypot(vax, vay)
      if (len < minSeg) continue
      const idx = segs.length
      segs.push({ a1, a2, vax, vay, len, line: li })
      grid.insert(
        idx,
        Math.min(a1.x, a2.x) - inflate,
        Math.min(a1.y, a2.y) - inflate,
        Math.max(a1.x, a2.x) + inflate,
        Math.max(a1.y, a2.y) + inflate,
      )
    }
  }

  // Best shared run per line pair — same math as the old maxSharedRun inner
  // loop: for the (lower, higher) line pair the original always projected
  // the higher line's segment onto the LOWER line's segment, so keep that
  // exact orientation regardless of candidate arrival order.
  const bestByPair = new Map<number, number>()
  grid.forEachCandidatePair((i, j) => {
    const sa = segs[i]
    const sb = segs[j]
    if (!sa || !sb || sa.line === sb.line) return
    // parallel check: normalized cross product ≈ sin(angle)
    if (Math.abs(sa.vax * sb.vay - sa.vay * sb.vax) / (sa.len * sb.len) > 0.02) return
    const la = lines[sa.line]
    const lb = lines[sb.line]
    if (!la || !lb) return
    const gap = (la.halfWidth ?? 1) + (lb.halfWidth ?? 1) + clearance
    const first = sa.line < sb.line ? sa : sb
    const second = sa.line < sb.line ? sb : sa
    const run = sharedRun(first, second, gap)
    if (run <= 0) return
    const key = sa.line < sb.line ? sa.line * 1048576 + sb.line : sb.line * 1048576 + sa.line
    const prev = bestByPair.get(key)
    if (prev === undefined || run > prev) bestByPair.set(key, run)
  })

  const out: CollinearOverlap[] = []
  for (const [key, shared] of bestByPair) {
    if (shared <= minShared) continue
    const la = lines[Math.floor(key / 1048576)]
    const lb = lines[key % 1048576]
    if (!la || !lb) continue
    out.push({ a: la.id, b: lb.id, sharedLength: shared })
  }
  return out
}

interface RunSeg {
  a1: Position
  a2: Position
  vax: number
  vay: number
  len: number
}

/** Shared extent of `b` projected onto `a` — the old maxSharedRun pair body. */
function sharedRun(a: RunSeg, b: RunSeg, gap: number): number {
  // perpendicular distance between the two lines
  const dx = b.a1.x - a.a1.x
  const dy = b.a1.y - a.a1.y
  if (Math.abs(dx * a.vay - dy * a.vax) / a.len > gap) return 0
  // shared extent along A's direction
  const t1 = (dx * a.vax + dy * a.vay) / a.len
  const t2 = ((b.a2.x - a.a1.x) * a.vax + (b.a2.y - a.a1.y) * a.vay) / a.len
  const lo = Math.max(0, Math.min(t1, t2))
  const hi = Math.min(a.len, Math.max(t1, t2))
  return hi - lo
}

// ============================================================================
// 4. Port / port-label clutter
// ============================================================================

/**
 * A geometric collision among the elements a node OWNS: its port
 * markers and their labels. The ownership chain (node → port → label)
 * only means something if these boxes are first-class geometry — v3
 * lesson re-learned: what isn't measured silently regresses.
 */
export interface PortClutter {
  kind: 'port-port' | 'label-label' | 'label-node'
  a: string
  b: string
}

const rectsOverlap = (a: Bounds, b: Bounds, margin = 0): boolean =>
  a.x < b.x + b.width + margin &&
  a.x + a.width > b.x - margin &&
  a.y < b.y + b.height + margin &&
  a.y + a.height > b.y - margin

/**
 * Find collisions among port boxes, among label boxes, and between a
 * label and a FOREIGN node box (a label may touch its own node).
 * O(n²) on layout-sized inputs.
 */
export function findPortClutter(
  ports: readonly ResolvedPort[],
  nodeBoxes: readonly BoxSpec[] = [],
): PortClutter[] {
  const boxes = ports.map((p) => ({ port: p, box: portBox(p), label: portLabelBox(p) }))

  // `rectsOverlap` at margin 0 IS bbox overlap, so grid candidates + the
  // same predicate find the identical collision set as the old O(n²) scan;
  // only the (unobservable to callers, who count) emit order differs —
  // kept deterministic by sorting on indices.
  const collect = (
    kind: PortClutter['kind'],
    rectOf: (b: (typeof boxes)[number]) => Bounds | null | undefined,
  ): PortClutter[] => {
    const grid = new BBoxGrid(96)
    for (const [i, b] of boxes.entries()) {
      const r = rectOf(b)
      if (r) grid.insert(i, r.x, r.y, r.x + r.width, r.y + r.height)
    }
    const pairs: Array<[number, number]> = []
    grid.forEachCandidatePair((i, j) => {
      const a = boxes[i]
      const b = boxes[j]
      if (!a || !b) return
      const ra = rectOf(a)
      const rb = rectOf(b)
      if (ra && rb && rectsOverlap(ra, rb)) pairs.push([i, j])
    })
    pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1])
    return pairs.map(([i, j]) => {
      const a = boxes[i]
      const b = boxes[j]
      return { kind, a: a?.port.id ?? '', b: b?.port.id ?? '' }
    })
  }

  const out: PortClutter[] = [
    ...collect('port-port', (b) => b.box),
    ...collect('label-label', (b) => b.label),
  ]

  // label vs FOREIGN node box — node grid, queried per label.
  const nodeGrid = new BBoxGrid(256)
  const nodeRects: Bounds[] = nodeBoxes.map((node) => ({
    x: node.x - node.width / 2,
    y: node.y - node.height / 2,
    width: node.width,
    height: node.height,
  }))
  for (const [ni, rect] of nodeRects.entries()) {
    nodeGrid.insert(ni, rect.x, rect.y, rect.x + rect.width, rect.y + rect.height)
  }
  for (const a of boxes) {
    if (!a.label) continue
    const label = a.label
    nodeGrid.query(label.x, label.y, label.x + label.width, label.y + label.height, (ni) => {
      const node = nodeBoxes[ni]
      const rect = nodeRects[ni]
      if (!node || !rect || node.id === a.port.nodeId) return
      if (rectsOverlap(label, rect)) {
        out.push({ kind: 'label-node', a: a.port.id, b: node.id })
      }
    })
  }
  return out
}

// ============================================================================
// 5. Edge-through-node piercing
// ============================================================================

/** Shared exact segment-intersection predicate (strict crossing). */
export function segmentsIntersect(a1: Position, a2: Position, b1: Position, b2: Position): boolean {
  const d1 = (a2.x - a1.x) * (b1.y - a1.y) - (a2.y - a1.y) * (b1.x - a1.x)
  const d2 = (a2.x - a1.x) * (b2.y - a1.y) - (a2.y - a1.y) * (b2.x - a1.x)
  const d3 = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)
  const d4 = (b2.x - b1.x) * (a2.y - b1.y) - (b2.y - b1.y) * (a2.x - b1.x)
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0
}

/** Edge polyline with its endpoint nodes (which it may legally touch). */
export interface PierceLineSpec {
  id: string
  points: readonly Position[]
  fromNodeId: string
  toNodeId: string
}

export interface EdgeNodePierce {
  edgeId: string
  nodeId: string
}

/**
 * Find wires that run THROUGH a foreign node box (inflated by `inflate`):
 * any segment crossing one of the box's four borders. A wire may touch its
 * own endpoints' boxes. Grid-accelerated, exact (same predicate as the old
 * routed-score inner loop — this IS that loop, extracted so the score and
 * the constraint check share one definition).
 */
export function findEdgeNodePiercing(
  lines: readonly PierceLineSpec[],
  nodeBoxes: readonly BoxSpec[],
  inflate = 2,
): EdgeNodePierce[] {
  const boxGrid = new BBoxGrid(320)
  for (const [idx, box] of nodeBoxes.entries()) {
    boxGrid.insert(
      idx,
      box.x - box.width / 2 - inflate,
      box.y - box.height / 2 - inflate,
      box.x + box.width / 2 + inflate,
      box.y + box.height / 2 + inflate,
    )
  }
  const out: EdgeNodePierce[] = []
  for (const line of lines) {
    const hitBoxes = new Set<number>()
    for (let s = 1; s < line.points.length; s++) {
      const a = line.points[s - 1]
      const b = line.points[s]
      if (!a || !b) continue
      boxGrid.query(a.x, a.y, b.x, b.y, (bi) => {
        if (hitBoxes.has(bi)) return
        const box = nodeBoxes[bi]
        if (!box || box.id === line.fromNodeId || box.id === line.toNodeId) return
        const bx = box.x - box.width / 2 - inflate
        const by = box.y - box.height / 2 - inflate
        const bw = box.width + inflate * 2
        const bh = box.height + inflate * 2
        if (Math.max(a.x, b.x) < bx || Math.min(a.x, b.x) > bx + bw) return
        if (Math.max(a.y, b.y) < by || Math.min(a.y, b.y) > by + bh) return
        const hit =
          segmentsIntersect(a, b, { x: bx, y: by }, { x: bx + bw, y: by }) ||
          segmentsIntersect(a, b, { x: bx, y: by + bh }, { x: bx + bw, y: by + bh }) ||
          segmentsIntersect(a, b, { x: bx, y: by }, { x: bx, y: by + bh }) ||
          segmentsIntersect(a, b, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh })
        if (hit) hitBoxes.add(bi)
      })
    }
    for (const bi of hitBoxes) {
      const box = nodeBoxes[bi]
      if (box) out.push({ edgeId: line.id, nodeId: box.id })
    }
  }
  return out
}

// ============================================================================
// 6. Container box overlap (non-nested subgraph boxes must be disjoint)
// ============================================================================

export interface BoxBounds {
  id: string
  bounds: Bounds
  /** Parent box id — ancestors legally contain their descendants. */
  parent?: string
}

export interface ContainerOverlap {
  a: string
  b: string
  /** Penetration depth (px) — min of x/y overlap. */
  penetration: number
}

/**
 * Find pairs of container boxes that overlap where NEITHER is an ancestor of
 * the other (nesting is legal containment, not interference).
 */
export function findContainerOverlaps(boxes: readonly BoxBounds[]): ContainerOverlap[] {
  const parentOf = new Map<string, string | undefined>()
  for (const b of boxes) parentOf.set(b.id, b.parent)
  const isAncestor = (maybeAncestor: string, id: string): boolean => {
    let current = parentOf.get(id)
    for (let depth = 0; current !== undefined && depth < 64; depth++) {
      if (current === maybeAncestor) return true
      current = parentOf.get(current)
    }
    return false
  }
  const out: ContainerOverlap[] = []
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    if (!a) continue
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (!b) continue
      if (isAncestor(a.id, b.id) || isAncestor(b.id, a.id)) continue
      const ox =
        Math.min(a.bounds.x + a.bounds.width, b.bounds.x + b.bounds.width) -
        Math.max(a.bounds.x, b.bounds.x)
      const oy =
        Math.min(a.bounds.y + a.bounds.height, b.bounds.y + b.bounds.height) -
        Math.max(a.bounds.y, b.bounds.y)
      if (ox > 0 && oy > 0) out.push({ a: a.id, b: b.id, penetration: Math.min(ox, oy) })
    }
  }
  return out
}

// ============================================================================
// ResolvedLayout adapter
// ============================================================================

export interface LayoutInvariantReport {
  nodeOverlaps: NodeOverlap[]
  containmentViolations: ContainmentViolation[]
  collinearOverlaps: CollinearOverlap[]
  portClutter: PortClutter[]
  ok: boolean
}

export interface LayoutInvariantOptions {
  /** Required clear space between node boxes. Default 0 (touching is ok). */
  nodeMargin?: number
  /** Containment padding inside subgraph bounds. Default 0. */
  containmentPad?: number
  collinear?: CollinearOptions
}

/**
 * Run all invariant checks against a ResolvedLayout. Containment uses
 * `node.parent` → subgraph bounds (subgraphs without bounds are skipped).
 * Edge tracks use `route.points` when present, else `points`.
 */
export function checkLayoutInvariants(
  layout: ResolvedLayout,
  options: LayoutInvariantOptions = {},
): LayoutInvariantReport {
  const boxes: BoxSpec[] = []
  for (const [id, node] of layout.nodes) {
    const pos = node.position
    if (!pos) continue
    const size = resolveNodeSize(node)
    boxes.push({ id, x: pos.x, y: pos.y, width: size.width, height: size.height })
  }

  const members = new Map<string, string[]>()
  for (const [id, node] of layout.nodes) {
    const parent = node.parent
    if (!parent) continue
    const list = members.get(parent)
    if (list) list.push(id)
    else members.set(parent, [id])
  }
  const containers: ContainerSpec[] = []
  for (const [id, sg] of layout.subgraphs) {
    const bounds = sg.bounds
    const memberIds = members.get(id)
    if (!bounds || !memberIds || memberIds.length === 0) continue
    containers.push({ id, bounds, memberIds })
  }

  const lines: PolylineSpec[] = []
  for (const [id, edge] of layout.edges) {
    const points = edge.route?.points ?? edge.points
    if (points.length < 2) continue
    lines.push({ id, points, halfWidth: Math.max(0.5, edge.width / 2) })
  }

  const nodeOverlaps = findNodeOverlaps(boxes, options.nodeMargin ?? 0)
  const containmentViolations = findContainmentViolations(
    boxes,
    containers,
    options.containmentPad ?? 0,
  )
  const collinearOverlaps = findCollinearOverlaps(lines, options.collinear)
  const portClutter = findPortClutter([...layout.ports.values()], boxes)
  return {
    nodeOverlaps,
    containmentViolations,
    collinearOverlaps,
    portClutter,
    ok:
      nodeOverlaps.length === 0 &&
      containmentViolations.length === 0 &&
      collinearOverlaps.length === 0 &&
      portClutter.length === 0,
  }
}
