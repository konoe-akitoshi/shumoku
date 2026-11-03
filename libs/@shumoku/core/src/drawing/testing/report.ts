// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../../input/model.js'
import type { Link } from '../../models/types.js'
import { compare, joinKey } from '../../structure/keys.js'
import type { Structure, Vertex } from '../../structure/types.js'
import { type SideKey, sideKey, splitSide } from '../keys.js'
import { type Keeps, keepOff, keepsOf } from '../kin.js'
import type { Box, Metrics, Point } from '../metrics.js'
import type { Line, LineRole, Problem } from '../problem.js'
import type { Scene, Side } from '../scene.js'
import { EPS } from '../tolerance.js'

/**
 * What a scene comes to, measured from the scene alone. The numbers describe a drawing and
 * decide nothing: a drawing is judged by looking at it, and these say where to look.
 */
interface SceneStats {
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

function sceneStats(
  scene: Scene,
  { network, structure }: Pick<ReportContext, 'network' | 'structure'>,
): SceneStats {
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

  // A hull's outline is a drawn plate like a card: a line through it that ends at none of its
  // members goes through a node.
  const hullBoxes = (scene.hulls ?? []).flatMap((h) =>
    h.box ? [{ members: h.members, box: h.box }] : [],
  )
  let throughNodes = 0
  let throughGroups = 0
  for (const w of wires) {
    for (const [id, box] of nodeBox) {
      if (w.ends.includes(id)) continue
      if (w.segments.some(([p, q]) => cuts(p, q, box))) throughNodes++
    }
    for (const h of hullBoxes) {
      if (w.ends.some((end) => h.members.includes(end))) continue
      if (w.segments.some(([p, q]) => cuts(p, q, h.box))) throughNodes++
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
    even: { pairs: evenPairs, apart: evenApart, worst: evenWorst },
    flowViolations,
    overlaps,
    outside,
    intrusions,
    wireLength,
    bends,
  }
}

/** How the room between boxes compares with what the lines running through it ask for. */
export interface GapReport {
  /** Runs that have a box on both sides to be measured against. */
  runs: number
  median: number
  p10: number
  min: number
  /** Runs with less room than they need: a defect. */
  below: number
}

/**
 * What the wiring of a scene comes to, measured from the scene alone (the problem only says
 * which lines the structure leaves unrelated and which end at a node sitting on a host). Like `Report`, the
 * numbers say where to look and decide nothing.
 */
interface WiringStats {
  /** Room between boxes for the runs that go across them, by the direction the runs go. */
  gap: { horizontalRuns: GapReport; verticalRuns: GapReport }
  /** Pairs of segments of different lines that run side by side closer than their gap, or on top of each other. */
  parallel: { near: number; overlapping: number }
  /** Ports drawn, and the ends of lines that should each stand at one. */
  ports: { drawn: number; ends: number }
  /** Segments that run in none of the 0, 45 and 90 degree directions. */
  offAxis: number
  /** Corners that turn back by more than a right angle. */
  sharp: number
  /**
   * Crossings between lines in the first stretches after their ports (the lead-out, the short
   * run across, and the run that follows), among the lines that leave one side of one box: the
   * crossings the order of the ports should leave none of, the fan's own included.
   */
  portCrossings: { total: number; sides: number; worst: { node: string; side: Side; n: number }[] }
  /**
   * Lines of the flow that go against it before they go with it: the line is read from the end
   * that leaves by a bottom side to the end that arrives by a top side, and goes up on the way.
   * Lines whose ends the structure does not relate (both ends on the same side) are counted
   * apart, as they leave and come back the same way by design. `examples` are the lines that rise most, where the rise turns, in
   * scene coordinates.
   */
  reversals: {
    unrelated: number
    plain: number
    examples: { from: string; to: string; at: Point; rise: number }[]
  }
  /** The longest lines. */
  longest: { from: string; to: string; length: number }[]
  /** The part of the summed length that the lines the structure leaves unrelated make up. */
  unrelatedShare: number
  /** The longest line that ends at a node sitting on a host, over the width of the drawing. */
  attachSpan: number
}

/** A straight stretch of a line along one axis: `at` is its coordinate across, `from`..`to` its extent. */
interface Run {
  line: number
  at: number
  from: number
  to: number
}

const round = (v: number) => Math.round(v * 1e4) / 1e4

const lengthOf = (points: readonly Point[]) =>
  points.reduce((sum, p, i) => {
    const q = points[i + 1]
    return q ? sum + Math.hypot(q.x - p.x, q.y - p.y) : sum
  }, 0)

function quantile(sorted: readonly number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? Number.NaN
}

/**
 * The stretches along one axis. `inner` leaves out the segment each line leaves its port by and
 * the one it arrives by, which belong to the port and not to a corridor.
 */
function runsOf(wires: readonly (readonly Point[])[], horizontal: boolean, inner: boolean): Run[] {
  const out: Run[] = []
  for (const [line, points] of wires.entries()) {
    const first = inner ? 1 : 0
    const last = inner ? points.length - 3 : points.length - 2
    for (let i = first; i <= last; i++) {
      const p = points[i]
      const q = points[i + 1]
      if (!p || !q) continue
      const [at, a, b, across] = horizontal
        ? [p.y, p.x, q.x, q.y - p.y]
        : [p.x, p.y, q.y, q.x - p.x]
      if (Math.abs(across) > EPS || Math.abs(b - a) <= EPS) continue
      out.push({ line, at, from: Math.min(a, b), to: Math.max(a, b) })
    }
  }
  return out
}

/**
 * The 45° stretches of one slant (`+1`: x + y is constant along it, `-1`: x − y is), in the frame
 * turned to the line: `at` is the distance across the line from the origin, `from`..`to` the
 * extent along it, both in the drawing's length.
 */
function slantedRunsOf(wires: readonly (readonly Point[])[], slant: 1 | -1): Run[] {
  const out: Run[] = []
  for (const [line, points] of wires.entries()) {
    for (const [i, p] of points.entries()) {
      const q = points[i + 1]
      if (!q) continue
      const dx = q.x - p.x
      const dy = q.y - p.y
      if (Math.abs(dx) <= EPS || Math.abs(Math.abs(dx) - Math.abs(dy)) > EPS) continue
      if (Math.sign(dx) * Math.sign(dy) !== -slant) continue
      const across = (pt: Point) => (pt.x + slant * pt.y) / Math.SQRT2
      const along = (pt: Point) => (pt.x - slant * pt.y) / Math.SQRT2
      out.push({
        line,
        at: across(p),
        from: Math.min(along(p), along(q)),
        to: Math.max(along(p), along(q)),
      })
    }
  }
  return out
}

/**
 * For each run, the room at its narrowest (`narrowest`): between the nearest boxes on either side
 * of it, over what the runs there at once ask for, the gap between each and a lead-out from a side
 * with a port on it, else a white. A run with no box on a side has no corridor there.
 */
function gapsOf(
  runs: readonly Run[],
  boxes: readonly Box[],
  horizontal: boolean,
  m: Metrics,
  /** Whether a box has a port on a side: only there is a lead-out kept, else a white. */
  hasPort: (box: Box, side: Side) => boolean,
  keeps: Keeps,
) {
  const ratios: number[] = []
  for (const run of runs) {
    const c = narrowest(run, runs, boxes, horizontal, keeps, (i, side) => {
      const b = boxes[i]
      return keepOff(m, b !== undefined && hasPort(b, side))
    })
    if (c) ratios.push(c.gap / c.need)
  }
  ratios.sort((a, b) => a - b)
  const report: GapReport = {
    runs: ratios.length,
    median: quantile(ratios, 0.5),
    p10: quantile(ratios, 0.1),
    min: ratios[0] ?? Number.NaN,
    below: ratios.filter((r) => r < 1 - EPS).length,
  }
  return report
}

function wiringStats(scene: Scene, metrics: Metrics, problem?: Problem): WiringStats {
  const wires = scene.wires.map((w) => w.points)
  const boxes = scene.nodes.map((n) => n.box)

  // A corridor with the edge of the drawing on one side is open there and has no room to measure.
  const portSides = new Map<string, Set<Side>>()
  for (const p of scene.ports ?? []) {
    portSides.set(p.nodeId, (portSides.get(p.nodeId) ?? new Set<Side>()).add(p.side))
  }
  const sidesOfBox = new Map<Box, Set<Side>>()
  for (const n of scene.nodes) sidesOfBox.set(n.box, portSides.get(n.node.id) ?? new Set<Side>())
  const hasPort = (b: Box, side: Side) => sidesOfBox.get(b)?.has(side) ?? false
  // A run's line is its index in the scene; the lines it is twin with are those of the problem.
  const lineAt = scene.wires.map(
    (w): Line =>
      problem?.lines.find((l) => l.link === w.link) ?? {
        id: '',
        link: w.link,
        a: { item: w.link.from.node },
        b: { item: w.link.to.node },
        stroke: w.stroke,
        family: joinKey([w.link.from.node, w.link.to.node].sort(compare)),
        role: 'oriented',
        flow: 'level',
      },
  )
  const keeps = keepsOf(metrics, (id) => lineAt[Number(id)])
  const gap = {
    horizontalRuns: gapsOf(runsOf(wires, true, true), boxes, true, metrics, hasPort, keeps),
    verticalRuns: gapsOf(runsOf(wires, false, true), boxes, false, metrics, hasPort, keeps),
  }
  const { portCrossings, reversals } = flowReports(scene)

  // Segments side by side: the axis-parallel ones, and the 45° ones of each slant, whose
  // distance is measured across the line (`slantedRunsOf`), not along an axis.
  let near = 0
  let overlapping = 0
  for (const runs of [
    runsOf(wires, true, false),
    runsOf(wires, false, false),
    slantedRunsOf(wires, 1),
    slantedRunsOf(wires, -1),
  ]) {
    for (const [i, s] of runs.entries()) {
      for (const t of runs.slice(i + 1)) {
        if (s.line === t.line) continue
        if (Math.min(s.to, t.to) - Math.max(s.from, t.from) <= EPS) continue
        const d = Math.abs(s.at - t.at)
        if (d <= EPS) overlapping++
        else if (d < keeps.between(s.line, t.line) - EPS) near++
      }
    }
  }

  const ends = new Set<string>()
  for (const [i, w] of scene.wires.entries()) {
    for (const [side, end] of [
      ['a', w.link.from],
      ['b', w.link.to],
    ] as const) {
      ends.add(end.port ? `${end.node}/${end.port}` : `${i}.${side}`)
    }
  }

  let offAxis = 0
  let sharp = 0
  for (const points of wires) {
    for (const [i, p] of points.entries()) {
      const q = points[i + 1]
      if (!q) continue
      const dx = Math.abs(q.x - p.x)
      const dy = Math.abs(q.y - p.y)
      if (dx > EPS && dy > EPS && Math.abs(dx - dy) > EPS) offAxis++
      const r = points[i + 2]
      if (!r) continue
      if ((q.x - p.x) * (r.x - q.x) + (q.y - p.y) * (r.y - q.y) < -EPS) sharp++
    }
  }

  // The problem may have been read again, so its lines are matched to the scene's by their ends,
  // in order among lines that join the same ends.
  const endsOf = (l: Link) =>
    joinKey([`${l.from.node}/${l.from.port ?? ''}`, `${l.to.node}/${l.to.port ?? ''}`])
  const satellites = new Set((problem?.satellites ?? []).map((s) => s.item))
  const roles = new Map<string, { role: LineRole; hosted: boolean }[]>()
  for (const l of problem?.lines ?? []) {
    const hosted = satellites.has(l.a.item) || satellites.has(l.b.item)
    roles.set(endsOf(l.link), [...(roles.get(endsOf(l.link)) ?? []), { role: l.role, hosted }])
  }
  const lengths = scene.wires.map((w) => ({
    from: w.link.from.node,
    to: w.link.to.node,
    length: lengthOf(w.points),
    ...roles.get(endsOf(w.link))?.shift(),
  }))
  const total = lengths.reduce((sum, l) => sum + l.length, 0)
  const unrelated = lengths
    .filter((l) => l.role === 'unrelated')
    .reduce((sum, l) => sum + l.length, 0)
  const attach = Math.max(0, ...lengths.filter((l) => l.hosted).map((l) => l.length))

  return {
    gap,
    parallel: { near, overlapping },
    ports: { drawn: scene.ports?.length ?? 0, ends: ends.size },
    offAxis,
    sharp,
    portCrossings,
    reversals,
    longest: [...lengths]
      .sort((a, b) => b.length - a.length)
      .slice(0, 5)
      .map(({ from, to, length }) => ({ from, to, length })),
    unrelatedShare: total === 0 ? 0 : unrelated / total,
    attachSpan: attach / Math.max(scene.bounds.width, EPS),
  }
}

/** Whether two axis-parallel segments cross at a point inside both. */
function cross(a: [Point, Point], b: [Point, Point]): boolean {
  const flat = (s: [Point, Point]) => Math.abs(s[0].y - s[1].y) <= EPS
  const tall = (s: [Point, Point]) => Math.abs(s[0].x - s[1].x) <= EPS
  const [h, v] = flat(a) && tall(b) ? [a, b] : flat(b) && tall(a) ? [b, a] : []
  if (!h || !v) return false
  const inside = (x: number, p: number, q: number) =>
    x > Math.min(p, q) + EPS && x < Math.max(p, q) - EPS
  return inside(v[0].x, h[0].x, h[1].x) && inside(h[0].y, v[0].y, v[1].y)
}

/** The crossings near the ports, and the lines that go against the flow, from the scene alone. */
function flowReports(scene: Scene): Pick<WiringStats, 'portCrossings' | 'reversals'> {
  const key = (p: Point) => `${round(p.x)},${round(p.y)}`
  const ports = new Map((scene.ports ?? []).map((p) => [key(p.at), p]))

  // the first three stretches from each port, by the side of the box they leave
  const heads = new Map<SideKey, { line: number; segs: [Point, Point][] }[]>()
  for (const [line, w] of scene.wires.entries()) {
    for (const points of [w.points, [...w.points].reverse()]) {
      const port = points[0] ? ports.get(key(points[0])) : undefined
      if (!port) continue
      const segs: [Point, Point][] = []
      for (let i = 0; i < 3; i++) {
        const p = points[i]
        const q = points[i + 1]
        if (p && q) segs.push([p, q])
      }
      const k = sideKey(port.nodeId, port.side)
      heads.set(k, [...(heads.get(k) ?? []), { line, segs }])
    }
  }
  let total = 0
  const worst: { node: string; side: Side; n: number }[] = []
  for (const [k, list] of heads) {
    let n = 0
    for (const [i, a] of list.entries()) {
      for (const b of list.slice(i + 1)) {
        if (a.line === b.line) continue
        for (const s of a.segs) for (const t of b.segs) if (cross(s, t)) n++
      }
    }
    if (n === 0) continue
    total += n
    const { box, side } = splitSide(k)
    worst.push({ node: box, side, n })
  }
  worst.sort((p, q) => q.n - p.n)

  let unrelated = 0
  let plain = 0
  const rises: { from: string; to: string; at: Point; rise: number }[] = []
  for (const w of scene.wires) {
    const first = w.points[0]
    const last = w.points[w.points.length - 1]
    const a = first ? ports.get(key(first)) : undefined
    const b = last ? ports.get(key(last)) : undefined
    if (!a || !b) continue
    if (a.side === b.side) {
      if (a.side === 'top' || a.side === 'bottom') unrelated++
      continue
    }
    // read from the end that leaves downward to the end that arrives from above
    const points = a.side === 'bottom' && b.side === 'top' ? w.points : [...w.points].reverse()
    if (!(a.side === 'bottom' && b.side === 'top') && !(a.side === 'top' && b.side === 'bottom')) {
      continue
    }
    let rise = 0
    let at: Point | undefined
    for (const [i, p] of points.entries()) {
      const q = points[i + 1]
      if (!q || q.y >= p.y - EPS) continue
      rise += p.y - q.y
      at = at ?? q
    }
    if (rise <= EPS || !at) continue
    plain++
    rises.push({ from: w.link.from.node, to: w.link.to.node, at, rise })
  }
  rises.sort((p, q) => q.rise - p.rise)
  return {
    portCrossings: { total, sides: worst.length, worst: worst.slice(0, 5) },
    reversals: { unrelated, plain, examples: rises.slice(0, 3) },
  }
}

/** What the report reads besides the scene. */
export interface ReportContext {
  network: input.Network
  structure: Structure
  /** The metrics the layout was made with: the room a run needs is counted from them. */
  metrics: Metrics
  /** The problem the layout solved; it says which lines the structure leaves unrelated. */
  problem?: Problem
}

/**
 * What a drawing comes to, measured from the scene (the problem only says which lines the
 * structure leaves unrelated and which end at a node sitting on a host). The numbers say where to
 * look and decide nothing: a drawing is judged by looking at it.
 */
export interface DrawingReport {
  size: Pick<SceneStats, 'width' | 'height' | 'aspect' | 'wireLength' | 'bends' | 'fill'>
  crossings: Pick<
    SceneStats,
    'crossings' | 'throughNodes' | 'throughGroups' | 'overlaps' | 'outside' | 'intrusions'
  >
  /** The room between boxes against what the runs there ask for, and how lines run side by side. */
  wiring: Pick<
    WiringStats,
    'gap' | 'parallel' | 'offAxis' | 'sharp' | 'longest' | 'unrelatedShare' | 'attachSpan'
  >
  /** Ports drawn, the ends that should each stand at one, and the crossings near them. */
  ports: WiringStats['ports'] & { crossings: WiringStats['portCrossings'] }
  /** How the drawing keeps to the flow of the structure. */
  flow: Pick<SceneStats, 'even' | 'flowViolations'> & { reversals: WiringStats['reversals'] }
}

export function drawingReport(scene: Scene, context: ReportContext): DrawingReport {
  const s = sceneStats(scene, context)
  const w = wiringStats(scene, context.metrics, context.problem)
  return {
    size: {
      width: s.width,
      height: s.height,
      aspect: s.aspect,
      wireLength: s.wireLength,
      bends: s.bends,
      fill: s.fill,
    },
    crossings: {
      crossings: s.crossings,
      throughNodes: s.throughNodes,
      throughGroups: s.throughGroups,
      overlaps: s.overlaps,
      outside: s.outside,
      intrusions: s.intrusions,
    },
    wiring: {
      gap: w.gap,
      parallel: w.parallel,
      offAxis: w.offAxis,
      sharp: w.sharp,
      longest: w.longest,
      unrelatedShare: w.unrelatedShare,
      attachSpan: w.attachSpan,
    },
    ports: { ...w.ports, crossings: w.portCrossings },
    flow: { even: s.even, flowViolations: s.flowViolations, reversals: w.reversals },
  }
}

/** A straight stretch along one axis: where across its heading it lies, and from where to where. */
interface Stretch {
  at: number
  from: number
  to: number
  /** The line it belongs to, which `pitchBetween` is asked about. */
  line?: string | number
}

/** The room a run has at its narrowest, against what the lines there ask for. */
interface Corridor {
  /** The room between the two boxes. */
  gap: number
  /** What the lines between them ask for: a gap between each, and a margin from each box. */
  need: number
  /** The index of the box on the low side and on the high side of the run. */
  before: number
  after: number
  /** How many lines are there at once. */
  lines: number
}

/**
 * The narrowest place along a run: the room between the nearest box on either side of it and
 * what the runs there at once ask for, the gap `keeps` between each and `margin` from each box, at the
 * worst of the stretches the run's extent is cut into by the edges of the boxes and the ends of
 * the other runs. Where the boxes beside a run change along it, so does the room, and the lines
 * that run beside it for a part of its way count only there. A run with no box on one side has
 * no corridor there.
 */
export function narrowest(
  run: Stretch,
  runs: readonly Stretch[],
  boxes: readonly Box[],
  horizontal: boolean,
  keeps: Keeps,
  /** The white from a box to the edge of the nearest line, by box and side. */
  margin: (box: number, side: Side) => number,
): Corridor | undefined {
  const extent = (b: Box): [number, number] =>
    horizontal ? [b.x, b.x + b.width] : [b.y, b.y + b.height]
  const across = (b: Box): [number, number] =>
    horizontal ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
  const [sLo, sHi]: [Side, Side] = horizontal ? ['bottom', 'top'] : ['right', 'left']
  const cuts = new Set<number>([run.from, run.to])
  for (const b of boxes)
    for (const e of extent(b)) if (e > run.from + EPS && e < run.to - EPS) cuts.add(e)
  for (const r of runs)
    for (const e of [r.from, r.to]) if (e > run.from + EPS && e < run.to - EPS) cuts.add(e)
  const places = [...cuts].sort((p, q) => p - q)
  let worst: Corridor | undefined
  for (const [k, s] of places.entries()) {
    const e = places[k + 1]
    if (e === undefined) continue
    let before = -1
    let after = -1
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const [i, b] of boxes.entries()) {
      const [e0, e1] = extent(b)
      if (e0 >= e - EPS || e1 <= s + EPS) continue
      const [c0, c1] = across(b)
      if (c1 <= run.at + EPS) {
        if (c1 > lo + EPS || (Math.abs(c1 - lo) <= EPS && i < before)) {
          lo = c1
          before = i
        }
      } else if (c0 >= run.at - EPS) {
        if (c0 < hi - EPS || (Math.abs(c0 - hi) <= EPS && i < after)) {
          hi = c0
          after = i
        }
      }
    }
    if (before < 0 || after < 0) continue
    const here = new Map<number, Stretch>()
    for (const r of runs) {
      if (r.at > lo - EPS && r.at < hi + EPS && r.from < e - EPS && r.to > s + EPS) {
        const key = Math.round(r.at / EPS)
        if (!here.has(key)) here.set(key, r)
      }
    }
    const stood = [...here.values()].sort((p, q) => p.at - q.at)
    const lines = Math.max(1, stood.length)
    let between = 0
    for (const [k, r] of stood.entries()) {
      const next = stood[k + 1]
      if (next) between += keeps.between(r.line, next.line)
    }
    const need =
      between +
      margin(before, sLo) +
      keeps.halo(stood[0]?.line) +
      margin(after, sHi) +
      keeps.halo(stood[stood.length - 1]?.line)
    const gap = hi - lo
    if (!worst || gap / need < worst.gap / worst.need) worst = { gap, need, before, after, lines }
  }
  return worst
}
