// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type CNode, type Corridors, opposite } from './corridors.js'
import type { Layers } from './layers.js'
import { boxKey, type FrameId, type Line, type Problem } from './problem.js'
import type { Side } from './scene.js'
import { sidesByRank } from './sides.js'

/**
 * A line's way through the corridors: the nodes it passes, the doors between them, and the wall
 * of each node it comes in by and goes out by. `nodes[0]` and the last are the sides of the
 * boxes it joins, in the order of the line's ends `a` and `b`.
 */
export interface Route {
  line: string
  nodes: number[]
  /** `doors[i]` joins `nodes[i]` and `nodes[i + 1]`. */
  doors: number[]
  /** The wall of each node the walk comes in by and leaves by (a side node: its own side, both). */
  walls: { in: Side; out: Side }[]
}

export interface Routes {
  routes: ReadonlyMap<string, Route>
}

/** The frames a line may be in without cost: those that hold either of its ends. */
export function allowedFrames(problem: Problem, line: Line): Set<FrameId> {
  const itemOf = new Map(problem.items.map((i) => [i.id, i]))
  const parent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const allowed = new Set<FrameId>()
  for (const end of [line.a, line.b]) {
    for (
      let f: FrameId | undefined = itemOf.get(end.item)?.frame;
      f !== undefined;
      f = parent.get(f)
    ) {
      allowed.add(f)
    }
  }
  return allowed
}

const WALLS: Side[] = ['top', 'right', 'bottom', 'left']
const wallIndex = (s: Side) => WALLS.indexOf(s)

/** How many corners a walk makes in a node: none going straight across, one for a turn, two coming back out. */
const bendsOf = (win: Side, wout: Side) => (win === wout ? 2 : opposite[win] === wout ? 0 : 1)

/**
 * Each line's way, the cheapest by the frames it has no business in, then the corners it turns,
 * then the nodes it passes: compared in that order and never added, so no weight is chosen.
 * A line that crosses ranks runs down the column its dummies stand in, rank by rank.
 */
export function routesOf(problem: Problem, layers: Layers, corridors: Corridors): Routes {
  const { nodes, doors, doorsOf } = corridors
  const rank = layers.ranks.rank
  const routes = new Map<string, Route>()

  // the cost of a walk, packed in the order its terms count in
  const FRAME = 1e12
  const BEND = 1e5
  const wallOf = (d: number, n: number): Side => {
    const door = doors[d]
    if (!door) return 'top'
    return door.a === n ? door.wallA : door.wallB
  }
  const otherEnd = (d: number, n: number): number => {
    const door = doors[d]
    return door ? (door.a === n ? door.b : door.a) : n
  }

  class Heap {
    private items: { cost: number; seq: number; state: number }[] = []
    private seq = 0
    get size() {
      return this.items.length
    }
    push(cost: number, state: number) {
      const items = this.items
      items.push({ cost, seq: this.seq++, state })
      let i = items.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        const a = items[i]
        const b = items[p]
        if (!a || !b || !this.less(a, b)) break
        items[i] = b
        items[p] = a
        i = p
      }
    }
    pop() {
      const items = this.items
      const top = items[0]
      const end = items.pop()
      if (items.length > 0 && end) {
        items[0] = end
        let i = 0
        for (;;) {
          const l = 2 * i + 1
          const r = l + 1
          let m = i
          const cur = items[m]
          const lv = items[l]
          if (lv && cur && this.less(lv, cur)) m = l
          const rv = items[r]
          const mv = items[m]
          if (rv && mv && this.less(rv, mv)) m = r
          if (m === i) break
          const a = items[i]
          const b = items[m]
          if (!a || !b) break
          items[i] = b
          items[m] = a
          i = m
        }
      }
      return top
    }
    private less(a: { cost: number; seq: number }, b: { cost: number; seq: number }) {
      return a.cost < b.cost || (a.cost === b.cost && a.seq < b.seq)
    }
  }

  const state0 = (n: number, w: Side) => n * 4 + wallIndex(w)
  const search = (
    starts: { node: number; wall: Side }[],
    goal: (node: number, wall: Side) => boolean,
    allowed: ReadonlySet<FrameId>,
    only?: Side,
  ): { nodes: number[]; doors: number[]; walls: Side[] } | undefined => {
    const best = new Map<number, number>()
    const prev = new Map<number, { from: number; door: number }>()
    const heap = new Heap()
    // a state is a node, the wall it was entered by, and whether the walk just left a cell that
    // turned it through a wall that opens on another cell (a dogleg would need a place to turn
    // that nothing there gives)
    const state = (n: number, w: Side, turned = false) =>
      (n * 4 + wallIndex(w)) * 2 + (turned ? 1 : 0)
    const plain = (st: number) => Math.floor(st / 2)
    for (const s of starts) {
      best.set(state(s.node, s.wall), 0)
      heap.push(0, state(s.node, s.wall))
    }
    const isStart = new Set(starts.map((s) => state(s.node, s.wall)))
    for (let top = heap.pop(); top; top = heap.pop()) {
      const { cost, state: st } = top
      if (cost > (best.get(st) ?? Number.POSITIVE_INFINITY)) continue
      const n = Math.floor(st / 8)
      const win = WALLS[plain(st) % 4] ?? 'top'
      const turned = st % 2 === 1
      const node = nodes[n]
      if (!node) continue
      if (!isStart.has(st) && goal(n, win)) {
        const ns: number[] = [n]
        const ds: number[] = []
        const ws: Side[] = [win]
        for (let at = st; !isStart.has(at); ) {
          const p = prev.get(at)
          if (!p) break
          ds.unshift(p.door)
          ns.unshift(Math.floor(p.from / 8))
          ws.unshift(WALLS[plain(p.from) % 4] ?? 'top')
          at = p.from
        }
        return { nodes: ns, doors: ds, walls: ws }
      }
      if (node.kind === 'side' && !isStart.has(st)) continue
      for (const d of doorsOf[n] ?? []) {
        const wout = wallOf(d, n)
        if (isStart.has(st) && only !== undefined && wout !== only) continue
        if (node.kind === 'side' && wout !== (win as Side)) continue
        const m = otherEnd(d, n)
        const mode = nodes[m]
        if (!mode) continue
        const wm = wallOf(d, m)
        const bends = node.kind === 'side' || isStart.has(st) ? 0 : bendsOf(win, wout)
        // a stretch that turns in one cell or column and runs on into the next one has nothing
        // to hold its other end at (the place of a turn is a port's or a column's), so there it
        // goes straight on until a box's side takes it
        if (turned && !isStart.has(st) && wout !== opposite[win]) continue
        if (mode.kind === 'side' && !goal(m, wm)) continue
        const outside = mode.kind !== 'side' && !allowed.has(mode.frame) ? 1 : 0
        const next = cost + outside * FRAME + bends * BEND + 1
        const flat = wout === 'left' || wout === 'right'
        const key = state(
          m,
          wm,
          (node.kind === 'cell' &&
            mode.kind === 'cell' &&
            !flat &&
            bends > 0 &&
            !isStart.has(st)) ||
            (node.kind === 'column' &&
              mode.kind === 'column' &&
              flat &&
              (turned || win === 'top' || win === 'bottom') &&
              !isStart.has(st)),
        )
        if (next < (best.get(key) ?? Number.POSITIVE_INFINITY)) {
          best.set(key, next)
          prev.set(key, { from: st, door: d })
          heap.push(next, key)
        }
      }
    }
    return undefined
  }

  for (const line of problem.lines) {
    const sides = sidesByRank(line, rank)
    if (!sides) continue
    const allowed = allowedFrames(problem, line)
    const sideNodes = (end: Line['a'], list: readonly Side[]) =>
      list.flatMap((s) => {
        const n = corridors.sideOf(boxKey(end), s)
        return n === undefined ? [] : [{ node: n, wall: s }]
      })
    const ra = rank.get(line.a.item) ?? 0
    const rb = rank.get(line.b.item) ?? 0
    // walked from the end at the lower rank (or `a` between equals) to the other
    const forward = ra <= rb
    const [from, to] = forward ? [line.a, line.b] : [line.b, line.a]
    const [fromSides, toSides] = forward ? [sides.a, sides.b] : [sides.b, sides.a]
    const starts = sideNodes(from, fromSides)
    const targets = new Set(sideNodes(to, toSides).map((s) => state0(s.node, s.wall)))
    const columns: number[] = []
    for (let r = Math.min(ra, rb) + 1; r < Math.max(ra, rb); r++) {
      const c = corridors.columnOfDummy.get(`dummy:${line.family}@${r}`)
      if (c !== undefined) columns.push(c)
    }
    const legs: { nodes: number[]; doors: number[]; walls: Side[] }[] = []
    let begin = starts
    let only: Side | undefined
    for (const c of [...columns, undefined]) {
      const leg =
        c === undefined
          ? search(begin, (n, w) => targets.has(state0(n, w)), allowed, only)
          : search(begin, (n, w) => n === c && w === 'top', allowed, only)
      if (!leg) throw new Error(`no way through the corridors for ${line.id}`)
      legs.push(leg)
      if (c !== undefined) {
        begin = [{ node: c, wall: 'top' }]
        only = 'bottom'
      }
    }
    // join the legs: a waypoint column is the end of one and the start of the next
    const ns: number[] = []
    const ds: number[] = []
    const ws: { in: Side; out: Side }[] = []
    for (const [li, leg] of legs.entries()) {
      for (const [i, n] of leg.nodes.entries()) {
        const win = leg.walls[i] ?? 'top'
        const wout = i < leg.doors.length ? wallOf(leg.doors[i] ?? 0, n) : win
        if (i === 0 && li > 0) {
          // the waypoint again: its walls were set by the leg that ended in it
          const last = ws[ws.length - 1]
          if (last) last.out = wout
          continue
        }
        ns.push(n)
        ws.push({ in: win, out: wout })
      }
      ds.push(...leg.doors)
    }
    // a start side node's walls: its side; the last node's out is its in
    const first = ws[0]
    if (first) first.in = first.out
    const route: Route = { line: line.id, nodes: ns, doors: ds, walls: ws }
    routes.set(line.id, forward ? route : reversed(route))
  }
  return { routes }

  function reversed(r: Route): Route {
    return {
      line: r.line,
      nodes: [...r.nodes].reverse(),
      doors: [...r.doors].reverse(),
      walls: [...r.walls].reverse().map((w) => ({ in: w.out, out: w.in })),
    }
  }
}

/** A node named by what bounds it, which does not move when a length does. */
export function nodeName(corridors: Corridors, n: number): string {
  const node: CNode | undefined = corridors.nodes[n]
  if (!node) return `#${n}`
  if (node.kind === 'cell') return `cell ${node.frame} ${node.gap} ${node.interval}`
  if (node.kind === 'column') return `column ${node.frame} ${node.rank} ${node.slot}`
  return `side ${node.box} ${node.side}`
}
