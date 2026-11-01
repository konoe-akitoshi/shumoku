// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '../models/types.js'
import { compare, joinKey, splitKey } from '../structure/keys.js'
import { narrowest } from './demands.js'
import { type Keeps, keepOff, keepsOf } from './kin.js'
import type { Box, Metrics, Point } from './metrics.js'
import type { Line, LineRole, Problem } from './problem.js'
import type { Scene, Side } from './scene.js'

/** How the room between boxes compares with what the lines running through it ask for. */
export interface GapReport {
  /** Runs that have a box on both sides to be measured against. */
  runs: number
  median: number
  p10: number
  min: number
  /** Runs with less room than they need: a defect. */
  below: number
  /** Runs with less than half as much again as they need: no room to spare. */
  tight: number
}

/**
 * What the wiring of a scene comes to, measured from the scene alone (the problem only says
 * which lines the structure leaves unrelated and which end at a node sitting on a host). Like `Report`, the
 * numbers say where to look and decide nothing.
 */
export interface WiringReport {
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

const EPS = 1e-6

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
    tight: ratios.filter((r) => r < 1.5 - EPS).length,
  }
  return report
}

export function wiringReport(scene: Scene, metrics: Metrics, problem?: Problem): WiringReport {
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
        width: w.width,
        family: joinKey([w.link.from.node, w.link.to.node].sort(compare)),
        role: 'oriented',
      },
  )
  const keeps = keepsOf(metrics, (id) => lineAt[Number(id)])
  const gap = {
    horizontalRuns: gapsOf(runsOf(wires, true, true), boxes, true, metrics, hasPort, keeps),
    verticalRuns: gapsOf(runsOf(wires, false, true), boxes, false, metrics, hasPort, keeps),
  }
  const { portCrossings, reversals } = flowReports(scene)

  let near = 0
  let overlapping = 0
  for (const horizontal of [true, false]) {
    const runs = runsOf(wires, horizontal, false)
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
function flowReports(scene: Scene): Pick<WiringReport, 'portCrossings' | 'reversals'> {
  const key = (p: Point) => `${round(p.x)},${round(p.y)}`
  const ports = new Map((scene.ports ?? []).map((p) => [key(p.at), p]))

  // the first three stretches from each port, by the side of the box they leave
  const heads = new Map<string, { line: number; segs: [Point, Point][] }[]>()
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
      const k = joinKey([port.nodeId, port.side])
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
    const [node = '', side = 'top'] = splitKey(k)
    worst.push({ node, side: side as Side, n })
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
