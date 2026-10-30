// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Grid } from './grid.js'
import type { Point } from './metrics.js'
import { centre, type PortPlan, simplify } from './ports.js'
import type { End, FrameId, Geometry, Line, Problem } from './problem.js'
import type { Side } from './scene.js'

/** Right, down, left, up. */
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]
const heading: Record<Side, number> = { right: 0, bottom: 1, left: 2, top: 3 }

/**
 * What a line costs, most important first: frames it has no business in, steps past their room
 * (only counted for a line laid over the drawing), crossings, bends, length.
 */
type Cost = [number, number, number, number, number]

function lexical(a: readonly number[], b: readonly number[]): number {
  for (const [i, v] of a.entries()) {
    const w = b[i] ?? 0
    if (v !== w) return v - w
  }
  return 0
}

/**
 * The search's frontier: entries are kept in parallel arrays and a binary heap holds their
 * indices, ordered by what they have cost and are expected to cost, most important first.
 */
class Queue {
  state: number[] = []
  last: number[] = []
  from: number[] = []
  c0: number[] = []
  c1: number[] = []
  c2: number[] = []
  c3: number[] = []
  c4: number[] = []
  r3: number[] = []
  r4: number[] = []
  r5: number[] = []
  private heap: number[] = []
  get size() {
    return this.heap.length
  }
  clear() {
    for (const a of [
      this.state,
      this.last,
      this.from,
      this.c0,
      this.c1,
      this.c2,
      this.c3,
      this.c4,
      this.r3,
      this.r4,
      this.r5,
      this.heap,
    ]) {
      a.length = 0
    }
  }
  private less(i: number, j: number): boolean {
    if (this.c0[i] !== this.c0[j]) return (this.c0[i] ?? 0) < (this.c0[j] ?? 0)
    if (this.c1[i] !== this.c1[j]) return (this.c1[i] ?? 0) < (this.c1[j] ?? 0)
    if (this.c2[i] !== this.c2[j]) return (this.c2[i] ?? 0) < (this.c2[j] ?? 0)
    if (this.r3[i] !== this.r3[j]) return (this.r3[i] ?? 0) < (this.r3[j] ?? 0)
    if (this.r4[i] !== this.r4[j]) return (this.r4[i] ?? 0) < (this.r4[j] ?? 0)
    return (this.r5[i] ?? 0) < (this.r5[j] ?? 0)
  }
  push(state: number, last: boolean, from: number, cost: Cost, r3: number, r4: number, r5: number) {
    const id = this.state.length
    this.state.push(state)
    this.last.push(last ? 1 : 0)
    this.from.push(from)
    this.c0.push(cost[0])
    this.c1.push(cost[1])
    this.c2.push(cost[2])
    this.c3.push(cost[3])
    this.c4.push(cost[4])
    this.r3.push(r3)
    this.r4.push(r4)
    this.r5.push(r5)
    const h = this.heap
    h.push(id)
    let i = h.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      const up = h[p] ?? 0
      if (!this.less(id, up)) break
      h[i] = up
      i = p
    }
    h[i] = id
  }
  pop(): number | undefined {
    const h = this.heap
    const top = h[0]
    const end = h.pop()
    if (top === undefined || end === undefined || h.length === 0) return top
    let i = 0
    for (;;) {
      const l = 2 * i + 1
      let m = l
      const r = l + 1
      if (l >= h.length) break
      if (r < h.length && this.less(h[r] ?? 0, h[l] ?? 0)) m = r
      if (!this.less(h[m] ?? 0, end)) break
      h[i] = h[m] ?? 0
      i = m
    }
    h[i] = end
    return top
  }
}

export interface Route {
  /** The grid nodes passed, from the point the first line leaves to where the last arrives. */
  nodes: number[]
  cost: Cost
}

export interface Routes {
  wires: Map<string, Point[]>
  ports: { id: string; nodeId: string; label?: string; at: Point; side: Side }[]
  /** Lines that no route was found for, drawn straight over everything. */
  unroutable: string[]
  /** The route of each line, as grid nodes. */
  routes: Map<string, Route>
}

/**
 * Routes the lines one by one over the grid, short ones first, each by the cheapest path:
 * fewest frames it has no business in, then fewest crossings of lines already laid, then fewest
 * bends, then shortest. These are compared in that order, never added, so no weight is chosen.
 * Then, if `refine` is set, every line that crosses another is laid again, one at a time, while that lowers its cost.
 * The search is first confined to a window around the two ends and the window is doubled until
 * it holds a route that stays out of other frames, or the whole grid.
 */
export function routeLines(
  problem: Problem,
  geometry: Geometry,
  plans: readonly PortPlan[],
  grid: Grid,
  refine = true,
  /** Whether the lines laid over the drawing are routed too, or only those that place things. */
  overlays = true,
): Routes {
  const { nx, ny, xs, ys } = grid
  const byLine = new Map<string, { a?: PortPlan; b?: PortPlan }>()
  for (const p of plans) {
    const entry = byLine.get(p.line.id) ?? {}
    byLine.set(p.line.id, p.end === 'a' ? { ...entry, a: p } : { ...entry, b: p })
  }
  const itemOf = new Map(problem.items.map((i) => [i.id, i]))
  const frameParent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const frameBit = new Map(grid.frames.map((id, i) => [id, i]))
  const chunks = grid.frameH.length

  /** The frames a line may be in without cost: those holding either end. */
  const badMask = (a: End, b: End): number[] => {
    const allowed = new Set<FrameId>()
    for (const end of [a, b]) {
      for (
        let f: FrameId | undefined = itemOf.get(end.item)?.frame;
        f !== undefined;
        f = frameParent.get(f)
      ) {
        allowed.add(f)
      }
    }
    const mask = new Array<number>(chunks).fill(0)
    for (const [id, i] of frameBit) {
      if (!allowed.has(id)) mask[i >> 5] = (mask[i >> 5] ?? 0) | (1 << (i & 31))
    }
    return mask
  }

  const nodeAt = (p: Point): number | undefined => {
    const ix = bisect(xs, p.x)
    const iy = bisect(ys, p.y)
    return ix === undefined || iy === undefined ? undefined : iy * nx + ix
  }

  const straightH = new Uint16Array(nx * ny)
  const straightV = new Uint16Array(nx * ny)
  // How many lines already run along each step, to tell when a corridor is full.
  const usedH = new Uint16Array(nx * ny)
  const usedV = new Uint16Array(nx * ny)
  const lay = (nodes: readonly number[], by: 1 | -1) => {
    for (let i = 1; i < nodes.length; i++) {
      const p = nodes[i - 1] ?? 0
      const q = nodes[i] ?? 0
      if (Math.floor(p / nx) === Math.floor(q / nx)) {
        const e = Math.min(p, q)
        usedH[e] = (usedH[e] ?? 0) + by
      } else {
        const e = Math.min(p, q)
        usedV[e] = (usedV[e] ?? 0) + by
      }
    }
    for (let i = 1; i + 1 < nodes.length; i++) {
      const p = nodes[i - 1] ?? 0
      const n = nodes[i] ?? 0
      const q = nodes[i + 1] ?? 0
      if (p % nx === n % nx && q % nx === n % nx) straightV[n] = (straightV[n] ?? 0) + by
      else if (
        Math.floor(p / nx) === Math.floor(n / nx) &&
        Math.floor(q / nx) === Math.floor(n / nx)
      ) {
        straightH[n] = (straightH[n] ?? 0) + by
      }
    }
  }

  const states = nx * ny * 4
  const stamp = new Int32Array(states)
  const bestCost = [0, 1, 2, 3, 4].map(() => new Float64Array(states))
  const parent = new Int32Array(states)
  let attempt = 0
  const queue = new Queue()

  const search = (
    from: number,
    heading0: number,
    to: number,
    inward: number,
    mask: number[],
    window: [number, number, number, number],
    capacity: boolean,
  ): Route | undefined => {
    const [wx0, wy0, wx1, wy1] = window
    const tx = xs[to % nx] ?? 0
    const ty = ys[Math.floor(to / nx)] ?? 0
    const near = (n: number): number =>
      Math.abs((xs[n % nx] ?? 0) - tx) + Math.abs((ys[Math.floor(n / nx)] ?? 0) - ty)
    /** The fewest bends still ahead: none if the target lies straight on, else one. */
    const turns = (n: number, d: number): number => {
      const dx = tx - (xs[n % nx] ?? 0)
      const dy = ty - (ys[Math.floor(n / nx)] ?? 0)
      if (dx === 0 && dy === 0) return 0
      if (dx !== 0 && dy !== 0) return 1
      const toward = dx !== 0 ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3
      return toward === d ? 0 : 1
    }
    const [b0, b1, b2, b3, b4] = bestCost as [
      Float64Array,
      Float64Array,
      Float64Array,
      Float64Array,
      Float64Array,
    ]
    const better = (s: number, c: Cost): boolean =>
      stamp[s] !== attempt ||
      lexical([b0[s] ?? 0, b1[s] ?? 0, b2[s] ?? 0, b3[s] ?? 0, b4[s] ?? 0], c) > 0
    attempt++
    queue.clear()
    const start = from * 4 + heading0
    stamp[start] = attempt
    b0[start] = 0
    b1[start] = 0
    b2[start] = 0
    b3[start] = 0
    b4[start] = 0
    parent[start] = -1
    queue.push(start, false, -1, [0, 0, 0, 0, 0], turns(from, heading0), near(from), near(from))
    while (queue.size > 0) {
      const id = queue.pop()
      if (id === undefined) break
      const state = queue.state[id] ?? 0
      const cost: Cost = [
        queue.c0[id] ?? 0,
        queue.c1[id] ?? 0,
        queue.c2[id] ?? 0,
        queue.c3[id] ?? 0,
        queue.c4[id] ?? 0,
      ]
      if (queue.last[id]) {
        const nodes: number[] = [to]
        for (let s = queue.from[id] ?? -1; s >= 0; s = parent[s] ?? -1)
          nodes.push(Math.floor(s / 4))
        return { nodes: nodes.reverse(), cost }
      }
      if (
        better(state, cost) === false &&
        lexical(
          [b0[state] ?? 0, b1[state] ?? 0, b2[state] ?? 0, b3[state] ?? 0, b4[state] ?? 0],
          cost,
        ) < 0
      ) {
        continue
      }
      const n = Math.floor(state / 4)
      const d = state % 4
      const ix = n % nx
      const iy = Math.floor(n / nx)
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue
        const jx = ix + (DX[nd] ?? 0)
        const jy = iy + (DY[nd] ?? 0)
        if (jx < wx0 || jx > wx1 || jy < wy0 || jy > wy1) continue
        const edge = nd === 2 ? iy * nx + jx : nd === 3 ? jy * nx + ix : iy * nx + ix
        const horizontal = nd % 2 === 0
        if ((horizontal ? grid.blockedH : grid.blockedV)[edge]) continue
        const frames = horizontal ? grid.frameH : grid.frameV
        let bad = 0
        for (const [c, m] of mask.entries()) if (((frames[c]?.[edge] ?? 0) & m) !== 0) bad = 1
        const over = capacity
          ? horizontal
            ? (usedH[edge] ?? 0) + 1 > (grid.capH[edge] ?? 0)
              ? 1
              : 0
            : (usedV[edge] ?? 0) + 1 > (grid.capV[edge] ?? 0)
              ? 1
              : 0
          : 0
        const straight = nd === d
        const cross = straight ? (d % 2 === 0 ? (straightV[n] ?? 0) : (straightH[n] ?? 0)) : 0
        const m = jy * nx + jx
        const len =
          Math.abs((xs[jx] ?? 0) - (xs[ix] ?? 0)) + Math.abs((ys[jy] ?? 0) - (ys[iy] ?? 0))
        const next: Cost = [
          cost[0] + bad,
          cost[1] + over,
          cost[2] + cross,
          cost[3] + (straight ? 0 : 1),
          cost[4] + len,
        ]
        const key = m * 4 + nd
        if (m === to) {
          const final: Cost = [
            next[0],
            next[1],
            next[2],
            next[3] + (nd === inward ? 0 : 1),
            next[4],
          ]
          queue.push(key, true, state, final, final[3], final[4], 0)
          continue
        }
        if (!better(key, next)) continue
        stamp[key] = attempt
        b0[key] = next[0]
        b1[key] = next[1]
        b2[key] = next[2]
        b3[key] = next[3]
        b4[key] = next[4]
        parent[key] = state
        queue.push(key, false, state, next, next[3] + turns(m, nd), next[4] + near(m), near(m))
      }
    }
    return undefined
  }

  const route = (a: PortPlan, b: PortPlan, capacity: boolean): Route | undefined => {
    const from = nodeAt(a.lead)
    const to = nodeAt(b.lead)
    if (from === undefined || to === undefined) return undefined
    if (from === to) return { nodes: [from], cost: [0, 0, 0, 0, 0] }
    const mask = badMask(a.ref, b.ref)
    const inward = (heading[b.side] + 2) % 4
    const fx = from % nx
    const fy = Math.floor(from / nx)
    const tx = to % nx
    const ty = Math.floor(to / nx)
    let found: Route | undefined
    for (let w = 1; ; w *= 2) {
      const window: [number, number, number, number] = [
        Math.max(0, Math.min(fx, tx) - w),
        Math.max(0, Math.min(fy, ty) - w),
        Math.min(nx - 1, Math.max(fx, tx) + w),
        Math.min(ny - 1, Math.max(fy, ty) + w),
      ]
      const r = search(from, heading[a.side], to, inward, mask, window, capacity)
      if (r && (!found || lexical(r.cost, found.cost) < 0)) found = r
      const whole =
        window[0] === 0 && window[1] === 0 && window[2] === nx - 1 && window[3] === ny - 1
      if ((found && found.cost[0] === 0 && (!capacity || found.cost[1] === 0)) || whole)
        return found
    }
  }

  const reach = (l: Line) => {
    const e = byLine.get(l.id)
    return e?.a && e.b ? Math.abs(e.a.lead.x - e.b.lead.x) + Math.abs(e.a.lead.y - e.b.lead.y) : 0
  }
  const rank = { oriented: 0, overlay: 1, inside: 2 }
  const order = problem.lines
    .filter((l) => l.role !== 'inside' && byLine.get(l.id)?.a && byLine.get(l.id)?.b)
    .filter((l) => overlays || l.role !== 'overlay')
    .sort((p, q) => rank[p.role] - rank[q.role] || reach(p) - reach(q) || compare(p.id, q.id))

  const routes = new Map<string, Route>()
  const unroutable: string[] = []
  for (const line of order) {
    const e = byLine.get(line.id)
    if (!e?.a || !e.b) continue
    const r = route(e.a, e.b, line.role === 'overlay')
    if (!r) {
      unroutable.push(line.id)
      continue
    }
    routes.set(line.id, r)
    lay(r.nodes, 1)
  }
  // Lay again the lines that cross another, worst first, while that makes them cheaper.
  for (let pass = 0; refine && pass < order.length; pass++) {
    let improved = false
    const crossing = order
      .filter((l) => (routes.get(l.id)?.cost[2] ?? 0) > 0)
      .sort((p, q) =>
        lexical(
          routes.get(q.id)?.cost ?? [0, 0, 0, 0, 0],
          routes.get(p.id)?.cost ?? [0, 0, 0, 0, 0],
        ),
      )
    for (const line of crossing) {
      const e = byLine.get(line.id)
      const old = routes.get(line.id)
      if (!e?.a || !e.b || !old) continue
      lay(old.nodes, -1)
      const r = route(e.a, e.b, line.role === 'overlay')
      if (r && lexical(r.cost, old.cost) < 0) {
        routes.set(line.id, r)
        lay(r.nodes, 1)
        improved = true
      } else {
        lay(old.nodes, 1)
      }
    }
    if (!improved) break
  }

  const wires = new Map<string, Point[]>()
  const ports: Routes['ports'] = []
  const named = new Set<string>()
  // Every end of every line stands at a port, named or not. Lines that name one port on a box
  // share it; the name is only what is written beside the point.
  const addPort = (end: End, at: Point, side: Side, line: Line, which: 'a' | 'b') => {
    const nodeId = end.node ?? end.item
    const id = end.port ? `${nodeId}/${end.port}` : `${nodeId}#${line.id}.${which}`
    if (named.has(id)) return
    named.add(id)
    ports.push({ id, nodeId, ...(end.port && { label: end.port }), at, side })
  }
  for (const line of order) {
    const e = byLine.get(line.id)
    const r = routes.get(line.id)
    if (!e?.a || !e.b) continue
    const points = r
      ? r.nodes.map((n): Point => ({ x: xs[n % nx] ?? 0, y: ys[Math.floor(n / nx)] ?? 0 }))
      : straightLead(e.a, e.b)
    wires.set(line.id, simplify([e.a.at, ...points, e.b.at]))
  }
  for (const p of plans) addPort(p.ref, p.at, p.side, p.line, p.end)

  insideWires(problem, geometry, wires, addPort)
  return { wires, ports, unroutable, routes }
}

/** A plain Z between two lead points, for a line no route was found for. */
function straightLead(a: PortPlan, b: PortPlan): Point[] {
  const vertical = a.side === 'top' || a.side === 'bottom'
  const mid = vertical ? (a.lead.y + b.lead.y) / 2 : (a.lead.x + b.lead.x) / 2
  return vertical
    ? [a.lead, { x: a.lead.x, y: mid }, { x: b.lead.x, y: mid }, b.lead]
    : [a.lead, { x: mid, y: a.lead.y }, { x: mid, y: b.lead.y }, b.lead]
}

function bisect(a: readonly number[], v: number): number | undefined {
  const target = Math.round(v * 1e4) / 1e4
  let lo = 0
  let hi = a.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const x = a[mid] ?? 0
    if (x === target) return mid
    if (x < target) lo = mid + 1
    else hi = mid - 1
  }
  return undefined
}

/** A line between two neighbours of one unit runs straight across, level with their centres. */
function insideWires(
  problem: Problem,
  geometry: Geometry,
  wires: Map<string, Point[]>,
  addPort: (end: End, at: Point, side: Side, line: Line, which: 'a' | 'b') => void,
) {
  const { pitch } = problem.metrics
  const boxOf = (end: End) =>
    geometry.boxes.get(end.node ?? end.item) ?? geometry.boxes.get(end.item)
  const pairs = new Map<string, Line[]>()
  for (const line of problem.lines) {
    if (line.role !== 'inside') continue
    const key = [line.a.node ?? line.a.item, line.b.node ?? line.b.item].sort(compare).join('\0')
    pairs.set(key, [...(pairs.get(key) ?? []), line])
  }
  for (const group of pairs.values()) {
    for (const [k, line] of group.entries()) {
      const a = boxOf(line.a)
      const b = boxOf(line.b)
      if (!a || !b) continue
      const [from, to] = centre(a).x <= centre(b).x ? [a, b] : [b, a]
      const level = (centre(a).y + centre(b).y) / 2 + (k - (group.length - 1) / 2) * pitch
      const p = { x: from.x + from.width, y: level }
      const q = { x: to.x, y: level }
      const [first, last] = from === a ? [p, q] : [q, p]
      wires.set(line.id, [first, last])
      addPort(line.a, first, from === a ? 'right' : 'left', line, 'a')
      addPort(line.b, last, from === a ? 'left' : 'right', line, 'b')
    }
  }
}
