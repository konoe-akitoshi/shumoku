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
  const out = new Map<string, CollinearOverlap>()
  for (let i = 0; i < lines.length; i++) {
    const la = lines[i]
    if (!la) continue
    for (let j = i + 1; j < lines.length; j++) {
      const lb = lines[j]
      if (!lb) continue
      const gap = (la.halfWidth ?? 1) + (lb.halfWidth ?? 1) + clearance
      const shared = maxSharedRun(la.points, lb.points, minSeg, gap)
      if (shared <= minShared) continue
      const key = `${la.id}|${lb.id}`
      const prev = out.get(key)
      if (!prev || shared > prev.sharedLength) {
        out.set(key, { a: la.id, b: lb.id, sharedLength: shared })
      }
    }
  }
  return [...out.values()]
}

function maxSharedRun(
  ptsA: readonly Position[],
  ptsB: readonly Position[],
  minSeg: number,
  gap: number,
): number {
  let best = 0
  for (let s = 1; s < ptsA.length; s++) {
    const a1 = ptsA[s - 1]
    const a2 = ptsA[s]
    if (!a1 || !a2) continue
    const vax = a2.x - a1.x
    const vay = a2.y - a1.y
    const lenA = Math.hypot(vax, vay)
    if (lenA < minSeg) continue
    for (let t = 1; t < ptsB.length; t++) {
      const b1 = ptsB[t - 1]
      const b2 = ptsB[t]
      if (!b1 || !b2) continue
      const vbx = b2.x - b1.x
      const vby = b2.y - b1.y
      const lenB = Math.hypot(vbx, vby)
      if (lenB < minSeg) continue
      // parallel check: normalized cross product ≈ sin(angle)
      if (Math.abs(vax * vby - vay * vbx) / (lenA * lenB) > 0.02) continue
      // perpendicular distance between the two lines
      const dx = b1.x - a1.x
      const dy = b1.y - a1.y
      if (Math.abs(dx * vay - dy * vax) / lenA > gap) continue
      // shared extent along A's direction
      const t1 = (dx * vax + dy * vay) / lenA
      const t2 = ((b2.x - a1.x) * vax + (b2.y - a1.y) * vay) / lenA
      const lo = Math.max(0, Math.min(t1, t2))
      const hi = Math.min(lenA, Math.max(t1, t2))
      if (hi - lo > best) best = hi - lo
    }
  }
  return best
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
  const out: PortClutter[] = []
  const boxes = ports.map((p) => ({ port: p, box: portBox(p), label: portLabelBox(p) }))
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i]
    if (!a) continue
    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j]
      if (!b) continue
      if (rectsOverlap(a.box, b.box)) {
        out.push({ kind: 'port-port', a: a.port.id, b: b.port.id })
      }
      if (a.label && b.label && rectsOverlap(a.label, b.label)) {
        out.push({ kind: 'label-label', a: a.port.id, b: b.port.id })
      }
    }
    if (a.label) {
      for (const node of nodeBoxes) {
        if (node.id === a.port.nodeId) continue
        const rect: Bounds = {
          x: node.x - node.width / 2,
          y: node.y - node.height / 2,
          width: node.width,
          height: node.height,
        }
        if (rectsOverlap(a.label, rect)) {
          out.push({ kind: 'label-node', a: a.port.id, b: node.id })
        }
      }
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
