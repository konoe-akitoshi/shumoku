// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure, Vertex } from '../structure/types.js'
import type { Box, Point } from './metrics.js'
import type { Scene } from './scene.js'

/**
 * What a scene comes to, measured from the scene alone. The numbers describe a drawing and
 * decide nothing: a drawing is judged by looking at it, and these say where to look.
 */
export interface Report {
  width: number
  height: number
  /** Width over height. */
  aspect: number
  /** Pairs of drawn line segments, of different lines, that cross. */
  crossings: number
  /** Lines that cut through a box that is not at either of their ends. */
  throughNodes: number
  /** Lines that cut through a group that holds neither of their ends. */
  throughGroups: number
  /** Content area over frame area, for each group and on average over the groups. */
  fill: { mean: number; groups: { id: string; fill: number }[] }
  /** Box area over the area a group is drawn as, on average; 1 when every group is a rectangle. */
  rectangularity: number
  /** Pairs given as level by the structure, how many differ in height, and by how much at most. */
  even: { pairs: number; apart: number; worst: number }
  /** Lines whose far end stands on the near end's side of the flow. */
  flowViolations: number
  /** Pairs of node boxes that overlap. */
  overlaps: number
  /** Boxes that are not inside the group they belong to. */
  outside: number
  /** Boxes inside a group they do not belong to. */
  intrusions: number
  /** The summed length of all lines. */
  wireLength: number
  /** Turns, over all lines. */
  bends: number
}

export interface ReportContext {
  network: input.Network
  structure: Structure
}

/** Where floating point noise stops mattering. */
const EPS = 1e-6

const area = (b: Box) => b.width * b.height
const centreY = (b: Box) => b.y + b.height / 2

function inside(inner: Box, outer: Box): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  )
}

function overlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width - EPS &&
    b.x < a.x + a.width - EPS &&
    a.y < b.y + b.height - EPS &&
    b.y < a.y + a.height - EPS
  )
}

function polygonArea(points: readonly Point[]): number {
  let twice = 0
  for (const [i, p] of points.entries()) {
    const q = points[(i + 1) % points.length]
    if (q) twice += p.x * q.y - q.x * p.y
  }
  return Math.abs(twice) / 2
}

const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)

/** Whether two segments cross at a point that is an end of neither. */
function crosses(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = side(a, b, c)
  const d2 = side(a, b, d)
  const d3 = side(c, d, a)
  const d4 = side(c, d, b)
  return d1 * d2 < -EPS && d3 * d4 < -EPS
}

/** Whether a segment runs through the inside of a box, not just along its edge or into it. */
function cuts(a: Point, b: Point, box: Box): boolean {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const clips: [number, number][] = [
    [-dx, a.x - box.x],
    [dx, box.x + box.width - a.x],
    [-dy, a.y - box.y],
    [dy, box.y + box.height - a.y],
  ]
  for (const [p, q] of clips) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
    }
  }
  if (t1 - t0 <= EPS) return false
  const m = (t0 + t1) / 2
  const x = a.x + dx * m
  const y = a.y + dy * m
  return (
    x > box.x + EPS &&
    x < box.x + box.width - EPS &&
    y > box.y + EPS &&
    y < box.y + box.height - EPS
  )
}

function segmentsOf(points: readonly Point[]): [Point, Point][] {
  const out: [Point, Point][] = []
  for (const [i, p] of points.entries()) {
    const q = points[i + 1]
    if (q) out.push([p, q])
  }
  return out
}

export function sceneReport(scene: Scene, { network, structure }: ReportContext): Report {
  const nodeBox = new Map(scene.nodes.map(({ node, box }) => [node.id, box]))
  const groupBox = new Map(scene.groups.map(({ group, box }) => [group.id, box]))
  const groupParent = new Map(scene.groups.map(({ group }) => [group.id, group.parent]))

  const ancestry = (id: string | undefined): Set<string> => {
    const chain = new Set<string>()
    for (let g = id; g !== undefined && !chain.has(g); g = groupParent.get(g)) chain.add(g)
    return chain
  }
  const nodeChain = new Map(scene.nodes.map(({ node }) => [node.id, ancestry(node.parent)]))

  const wires = scene.wires.map((w) => ({
    ends: [w.link.from.node, w.link.to.node],
    segments: segmentsOf(w.points),
  }))

  let crossings = 0
  for (const [i, a] of wires.entries()) {
    for (const b of wires.slice(i + 1)) {
      for (const [p, q] of a.segments) {
        for (const [r, s] of b.segments) if (crosses(p, q, r, s)) crossings++
      }
    }
  }

  let throughNodes = 0
  let throughGroups = 0
  for (const w of wires) {
    for (const [id, box] of nodeBox) {
      if (w.ends.includes(id)) continue
      if (w.segments.some(([p, q]) => cuts(p, q, box))) throughNodes++
    }
    for (const [id, box] of groupBox) {
      if (w.ends.some((end) => nodeChain.get(end)?.has(id))) continue
      if (w.segments.some(([p, q]) => cuts(p, q, box))) throughGroups++
    }
  }

  const contained = new Map<string, number>()
  for (const { node, box } of scene.nodes) {
    for (const g of nodeChain.get(node.id) ?? []) {
      contained.set(g, (contained.get(g) ?? 0) + area(box))
    }
  }
  const fills = scene.groups.map(({ group, box }) => ({
    id: group.id,
    fill: (contained.get(group.id) ?? 0) / Math.max(area(box), EPS),
  }))
  const shapes = scene.groups.map(({ box, outline }) =>
    outline ? area(box) / Math.max(polygonArea(outline), EPS) : 1,
  )
  const mean = (xs: number[]) => (xs.length === 0 ? 1 : xs.reduce((a, b) => a + b, 0) / xs.length)

  // A vertex is drawn as the box of its node; a folded set of nodes as the box around them.
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r.nodes]))
  const boxOf = (v: Vertex): Box | undefined => {
    const id = 'unit' in v ? v.unit : 'segment' in v ? v.segment : v.routingDomain
    const own = nodeBox.get(id)
    if (own) return own
    const boxes = (sets.get(id) ?? []).flatMap((n) => nodeBox.get(n) ?? [])
    if (boxes.length === 0) return undefined
    const x0 = Math.min(...boxes.map((b) => b.x))
    const y0 = Math.min(...boxes.map((b) => b.y))
    const x1 = Math.max(...boxes.map((b) => b.x + b.width))
    const y1 = Math.max(...boxes.map((b) => b.y + b.height))
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  }
  let evenPairs = 0
  let evenApart = 0
  let evenWorst = 0
  let flowViolations = 0
  for (const plane of structure.planes) {
    for (const [a, b] of plane.even) {
      const ba = boxOf(a)
      const bb = boxOf(b)
      if (!ba || !bb) continue
      evenPairs++
      const apart = Math.abs(centreY(ba) - centreY(bb))
      if (apart > EPS) evenApart++
      evenWorst = Math.max(evenWorst, apart)
    }
    for (const [near, far] of plane.flows) {
      const bn = boxOf(near)
      const bf = boxOf(far)
      if (!bn || !bf) continue
      const farther = centreY(bf) - centreY(bn)
      if (plane.side === 'physical' ? farther < -EPS : farther > EPS) flowViolations++
    }
  }

  let overlaps = 0
  for (const [i, a] of scene.nodes.entries()) {
    for (const b of scene.nodes.slice(i + 1)) if (overlap(a.box, b.box)) overlaps++
  }
  let outside = 0
  let intrusions = 0
  for (const { node, box } of scene.nodes) {
    const parent = node.parent === undefined ? undefined : groupBox.get(node.parent)
    if (parent && !inside(box, parent)) outside++
    for (const [id, g] of groupBox) {
      if (!nodeChain.get(node.id)?.has(id) && overlap(box, g)) intrusions++
    }
  }
  for (const { group, box } of scene.groups) {
    const parent = group.parent === undefined ? undefined : groupBox.get(group.parent)
    if (parent && !inside(box, parent)) outside++
  }

  let wireLength = 0
  let bends = 0
  for (const w of scene.wires) {
    bends += Math.max(0, w.points.length - 2)
    for (const [p, q] of segmentsOf(w.points)) wireLength += Math.hypot(q.x - p.x, q.y - p.y)
  }

  return {
    width: scene.bounds.width,
    height: scene.bounds.height,
    aspect: scene.bounds.width / Math.max(scene.bounds.height, EPS),
    crossings,
    throughNodes,
    throughGroups,
    fill: { mean: mean(fills.map((f) => f.fill)), groups: fills },
    rectangularity: mean(shapes),
    even: { pairs: evenPairs, apart: evenApart, worst: evenWorst },
    flowViolations,
    overlaps,
    outside,
    intrusions,
    wireLength,
    bends,
  }
}
