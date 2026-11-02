// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type Corridors, opposite } from './corridors.js'
import { laneOrder } from './crossing.js'
import type { Layers } from './layers.js'
import { portId } from './ports.js'
import {
  boxKey,
  type End,
  type FrameId,
  frameKey,
  type Line,
  linesById,
  type Problem,
} from './problem.js'
import type { Route, Routes } from './routes.js'
import type { Side } from './scene.js'

/**
 * Where each line runs inside each corridor, by indices alone: which of the lines in a column
 * stands left of which, which of the lines in a row above which, which port on a side comes
 * first, and how the lines of two neighbouring ranks interleave across the gap between them. A
 * line is a chain of coordinates, each the place of a port on the edge of a box (`x` on a top or
 * bottom edge, `y` on a left or right one) or of the stretch it runs along in a node (a column's
 * is an `x`, a row's a `y`), and the chain alternates between the two axes.
 */

export type Axis = 'x' | 'y'

export interface Entity {
  id: string
  /** The id the scene calls it. */
  sceneId: string
  box: string
  side: Side
  axis: Axis
  nodeId: string
  label?: string
  ends: { line: string; end: 'a' | 'b' }[]
}

/** The stretch a line runs along inside one node. */
export interface Lane {
  key: string
  line: string
  node: number
  /** The place of the node on the route. */
  at: number
  win: Side
  wout: Side
  axis: Axis
  /** A lane that turns the line is a stretch of its own; one that goes straight across is only a connector, used when the line's neighbours do not already line up. */
  essential: boolean
  used: boolean
  /** The lanes that are one stretch carried through several nodes share a run. */
  run: number
}

/** A coordinate in a line's chain: a port (by entity id) or a lane (by key). */
export type Var = { kind: 'port'; id: string } | { kind: 'lane'; key: string }
export const varKey = (v: Var) => (v.kind === 'port' ? `p:${v.id}` : `l:${v.key}`)

/** One place in the merged order of two neighbouring ranks. */
export interface MElem {
  /** The variable (`varKey`) it stands for, or none for a marker that holds a place for a box or a column with no line. */
  ref?: string
  /** Whether it belongs to the rank above the gap or to the rank below. */
  side: 'top' | 'bottom'
  /** The slot of its rank it stands in. */
  slot: number
}

export interface Tracks {
  entities: ReadonlyMap<string, Entity>
  lanes: ReadonlyMap<string, Lane>
  /** For each line, its chain of coordinates in order. */
  chains: ReadonlyMap<string, readonly Var[]>
  /** Pairs of coordinates in a chain that are one and the same (a run carried on, level ports). */
  joined: readonly (readonly [string, string])[]
  /** The lanes of each column, left to right, and of each cell, top to bottom. */
  columns: ReadonlyMap<number, readonly string[]>
  cells: ReadonlyMap<number, readonly string[]>
  /** The ports on each side of a box (`box\0side`), in order along the side. */
  ports: ReadonlyMap<string, readonly string[]>
  /** The merged order of the coordinates of two neighbouring ranks, for the gap g at `merged[g + 1]`. */
  merged: readonly (readonly MElem[])[]
  /** For each cell lane, the first and last place in the merged order of its gap it spans. */
  spans: ReadonlyMap<string, readonly [number, number]>
  /** The places of a stretch of slots on one side of a gap, as a stretch of the merged order. */
  reach(gap: number, side: 'top' | 'bottom', from: number, to: number): [number, number] | undefined
  /** Whether the frames leave a slot of the rank above a gap and one of the rank below free to stand at one place across. */
  free(gap: number, top: number, bottom: number): boolean
  /** On which gaps, and on which side of each, a coordinate is met in the merged order. */
  places(v: Var): { gap: number; side: 'top' | 'bottom' }[]
  /** What the orders chosen cost in crossings at the nodes they were chosen in. */
  crossings: number
}

const BIG = 1e6
const base: Record<Side, number> = { top: 0, right: 1, bottom: 2, left: 3 }

/**
 * Where an exit stands among the exits of a node, counted clockwise from the wall the lines come
 * in by: the wall first, then the place along it.
 */
function chordRank(entry: Side, wall: Side, pos: number): number {
  let cc = (base[wall] - base[entry] + 4) % 4
  if (cc === 0) cc = 4
  return cc * BIG + (wall === 'top' || wall === 'right' ? pos : -pos)
}

/** Whether two lines coming in by one wall, in the order given along it, must cross for their exits. */
function crosses(entry: Side, a: number, b: number): number {
  if (a === b) return 0
  return entry === 'top' || entry === 'right' ? (a < b ? 1 : 0) : a > b ? 1 : 0
}

export function tracksOf(
  problem: Problem,
  layers: Layers,
  corridors: Corridors,
  routes: Routes,
): Tracks {
  const { nodes, doors, slots } = corridors
  const byLine = linesById(problem)
  const gaps = layers.ranks.max + 2
  const routeList = [...routes.routes.values()].sort((p, q) => compare(p.line, q.line))

  // ---- the chain of coordinates of every line
  const entities = new Map<string, Entity>()
  const lanes = new Map<string, Lane>()
  const chains = new Map<string, Var[]>()
  const joined: [string, string][] = []
  const runOf = new Map<string, string>()
  const find = (k: string): string => {
    const p = runOf.get(k) ?? k
    if (p === k) return k
    const r = find(p)
    runOf.set(k, r)
    return r
  }
  const entityOf = (line: Line, end: 'a' | 'b', side: Side): Entity => {
    const e: End = end === 'a' ? line.a : line.b
    const nodeId = e.node ?? e.item
    const sceneId = portId(nodeId, e.port, line.id, end)
    const id = `${sceneId}|${side}`
    const known = entities.get(id)
    if (known) {
      known.ends.push({ line: line.id, end })
      return known
    }
    const ent: Entity = {
      id,
      sceneId,
      box: boxKey(e),
      side,
      axis: side === 'top' || side === 'bottom' ? 'x' : 'y',
      nodeId,
      ...(e.port && { label: e.port }),
      ends: [{ line: line.id, end }],
    }
    entities.set(id, ent)
    return ent
  }
  const sideOfNode = (n: number): Side => {
    const node = nodes[n]
    return node?.kind === 'side' ? node.side : 'top'
  }
  for (const route of routeList) {
    const line = byLine.get(route.line)
    if (!line) continue
    const last = route.nodes.length - 1
    const ea = entityOf(line, 'a', sideOfNode(route.nodes[0] ?? 0))
    const eb = entityOf(line, 'b', sideOfNode(route.nodes[last] ?? 0))
    const items: { v: Var; essential: boolean; axis: Axis }[] = [
      { v: { kind: 'port', id: ea.id }, essential: true, axis: ea.axis },
    ]
    for (let i = 1; i < last; i++) {
      const node = nodes[route.nodes[i] ?? 0]
      const w = route.walls[i]
      if (!node || !w || node.kind === 'side') continue
      const straight = opposite[w.in] === w.out
      const pass =
        node.kind === 'cell'
          ? straight && (w.in === 'top' || w.in === 'bottom')
          : straight && (w.in === 'left' || w.in === 'right')
      const key = `${route.line}@${i - 1}`
      const axis: Axis = node.kind === 'cell' ? 'y' : 'x'
      lanes.set(key, {
        key,
        line: route.line,
        node: route.nodes[i] ?? 0,
        at: i,
        win: w.in,
        wout: w.out,
        axis,
        essential: !pass,
        used: !pass,
        run: 0,
      })
      items.push({ v: { kind: 'lane', key }, essential: !pass, axis })
    }
    items.push({ v: { kind: 'port', id: eb.id }, essential: true, axis: eb.axis })
    const keep = new Set<number>()
    let prev = 0
    keep.add(0)
    for (let k = 1; k < items.length; k++) {
      if (!items[k]?.essential) continue
      const [p, q] = [items[prev], items[k]]
      if (p && q && p.axis === q.axis) {
        const between = items.slice(prev + 1, k)
        const levelStraight =
          between.length > 0 && p.axis === 'y' && prev === 0 && k === items.length - 1
        if (levelStraight || between.length === 0) joined.push([varKey(p.v), varKey(q.v)])
        else {
          const c = between[0]
          if (c) {
            keep.add(prev + 1)
            const lane = c.v.kind === 'lane' ? lanes.get(c.v.key) : undefined
            if (lane) lane.used = true
          }
        }
      }
      keep.add(k)
      prev = k
    }
    chains.set(
      route.line,
      items.flatMap((it, k) => (keep.has(k) ? [it.v] : [])),
    )
  }
  for (const [a, b] of joined) {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) runOf.set(ra, rb)
  }
  let runs = 0
  const runIds = new Map<string, number>()
  for (const lane of lanes.values()) {
    const r = find(varKey({ kind: 'lane', key: lane.key }))
    if (!runIds.has(r)) runIds.set(r, runs++)
    lane.run = runIds.get(r) ?? 0
  }

  const used = (key: string) => lanes.get(key)?.used === true
  /** Where each variable stands in its chains: the line and the place. */
  const occ = new Map<string, { line: string; at: number }[]>()
  for (const [line, chain] of chains) {
    for (const [at, v] of chain.entries()) {
      if (v.kind === 'lane' && !used(v.key)) continue
      const k = varKey(v)
      occ.set(k, [...(occ.get(k) ?? []), { line, at }])
    }
  }
  const axisOf = (v: Var): Axis =>
    v.kind === 'port' ? (entities.get(v.id)?.axis ?? 'x') : (lanes.get(v.key)?.axis ?? 'x')
  const slotRank = (box: string) => corridors.boxes.get(box)?.rank ?? 0

  // ---- the doors of a lane: where a line goes on from the node it runs in
  const doorOf = (route: Route, i: number, forward: boolean) => {
    const d = doors[route.doors[forward ? i : i - 1] ?? -1]
    return d
  }
  const posAt = (d: { a: number; posA: number; posB: number } | undefined, n: number) =>
    d ? (d.a === n ? d.posA : d.posB) : 0
  /** Where, among the exits of the cell beside a column, the line goes on: from the far side of that cell. */
  const exitOf = (lane: Lane, wall: Side): { entry: Side; at: number } | undefined => {
    const route = routes.routes.get(lane.line)
    if (!route) return undefined
    const i = lane.at
    const inSide = lane.win === wall
    const j = inSide ? i - 1 : i + 1
    const cell = route.nodes[j]
    const exitWall = inSide ? route.walls[j]?.in : route.walls[j]?.out
    const d = inSide ? doorOf(route, j, false) : doorOf(route, j, true)
    if (cell === undefined || exitWall === undefined || !d) return undefined
    return { entry: opposite[wall], at: chordRank(opposite[wall], exitWall, posAt(d, cell)) }
  }

  // ---- 1. the lines in each column, left to right
  const dummyAt = (lane: Lane): number => {
    const node = nodes[lane.node]
    const line = byLine.get(lane.line)
    if (!line || node?.kind !== 'column') return Number.POSITIVE_INFINITY
    return layers.position.get(`dummy:${line.family}@${node.rank}`) ?? Number.POSITIVE_INFINITY
  }
  const columns = new Map<number, string[]>()
  let crossings = 0
  const inNode = new Map<number, Lane[]>()
  for (const lane of lanes.values()) {
    if (!lane.used) continue
    inNode.set(lane.node, [...(inNode.get(lane.node) ?? []), lane])
  }
  const nodeIds = [...inNode.keys()].sort((p, q) => p - q)
  const columnCost = (a: Lane, b: Lane): number => {
    let cost = 0
    for (const wall of ['top', 'bottom'] as const) {
      if (a.win !== wall && a.wout !== wall) continue
      if (b.win !== wall && b.wout !== wall) continue
      const [ea, eb] = [exitOf(a, wall), exitOf(b, wall)]
      if (ea && eb) cost += crosses(ea.entry, ea.at, eb.at)
    }
    const right = (l: Lane) => l.win === 'right' || l.wout === 'right'
    const left = (l: Lane) => l.win === 'left' || l.wout === 'left'
    if (right(a) && !right(b)) cost++
    if (left(b) && !left(a)) cost++
    return cost
  }
  for (const id of nodeIds) {
    const node = nodes[id]
    if (node?.kind !== 'column') continue
    const list = (inNode.get(id) ?? []).sort(
      (p, q) => dummyAt(p) - dummyAt(q) || compare(p.key, q.key),
    )
    const byKey = new Map(list.map((l) => [l.key, l]))
    const cost = (x: string, y: string) => {
      const [a, b] = [byKey.get(x), byKey.get(y)]
      return a && b ? columnCost(a, b) : 0
    }
    const { order } = laneOrder(
      list.map((l) => l.key),
      cost,
    )
    columns.set(id, order)
    for (const [i, a] of order.entries())
      for (const b of order.slice(i + 1)) crossings += cost(a, b)
  }

  // ---- 2. the merged order of every gap
  /** Where a coordinate stands: on which gaps it is met, and on which side of each. */
  const placesOf = (v: Var): { gap: number; side: 'top' | 'bottom' }[] => {
    if (v.kind === 'port') {
      const e = entities.get(v.id)
      if (!e || e.axis !== 'x') return []
      const r = slotRank(e.box)
      return e.side === 'bottom' ? [{ gap: r, side: 'top' }] : [{ gap: r - 1, side: 'bottom' }]
    }
    const lane = lanes.get(v.key)
    const node = lane ? nodes[lane.node] : undefined
    if (!lane || node?.kind !== 'column') return []
    const out: { gap: number; side: 'top' | 'bottom' }[] = []
    if (lane.win === 'bottom' || lane.wout === 'bottom') out.push({ gap: node.rank, side: 'top' })
    if (lane.win === 'top' || lane.wout === 'top') out.push({ gap: node.rank - 1, side: 'bottom' })
    return out
  }
  const portOrder = new Map<string, string[]>()
  const sideKey = (box: string, side: Side) => `${box}\0${side}`
  for (const e of [...entities.values()].sort((p, q) => compare(p.id, q.id))) {
    const k = sideKey(e.box, e.side)
    portOrder.set(k, [...(portOrder.get(k) ?? []), e.id])
  }
  /** The nearest coordinate of the other axis along a line from a place in its chain. */
  const neighbour = (line: string, at: number, step: 1 | -1): Var | undefined => {
    const chain = chains.get(line) ?? []
    const mine = chain[at]
    if (!mine) return undefined
    let crossed = false
    for (let k = at + step; k >= 0 && k < chain.length; k += step) {
      const v = chain[k]
      if (!v) continue
      if (axisOf(v) !== axisOf(mine)) crossed = true
      else if (crossed) return v
    }
    return undefined
  }
  const destSlot = (ent: Entity): number => {
    const first = ent.ends[0]
    if (!first) return 0
    const chain = chains.get(first.line) ?? []
    const at = first.end === 'a' ? 0 : chain.length - 1
    const far = neighbour(first.line, at, first.end === 'a' ? 1 : -1)
    if (!far) return 0
    if (far.kind === 'port') {
      const e = entities.get(far.id)
      return corridors.slotOf.get(e?.box ?? '') ?? 0
    }
    const lane = lanes.get(far.key)
    return lane ? (corridors.slotOf.get(`col:${lane.node}`) ?? 0) : 0
  }
  const provisional = new Map<string, string[]>()
  for (const [k, list] of portOrder) {
    provisional.set(
      k,
      [...list].sort((p, q) => {
        const [a, b] = [entities.get(p), entities.get(q)]
        if (!a || !b) return 0
        return a.axis === 'x' ? destSlot(a) - destSlot(b) || compare(p, q) : compare(p, q)
      }),
    )
  }

  // ---- where the frames put things: two things in frames that stand side by side stand so in
  // every rank, whatever the order of the lines between them
  const sibIndex = new Map<string, number>()
  for (const [f, list] of layers.siblings)
    for (const [i, k] of list.entries()) sibIndex.set(`${f}\0${k}`, i)
  const frameParent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const ancestry = (frame: FrameId): FrameId[] => {
    const out: FrameId[] = []
    for (let f: FrameId | undefined = frame; f !== undefined; f = frameParent.get(f)) out.unshift(f)
    return out
  }
  const frameIds = new Set(problem.frames.map((f) => frameKey(f.id)))
  const spanOfKey = (k: string) => layers.ranks.span.get(k)
  const kidsAt = new Map<string, string[]>()
  const colKids = (f: FrameId, r: number): string[] => {
    const memo = kidsAt.get(`${f}\0${r}`)
    if (memo) return memo
    const out = (layers.siblings.get(f) ?? []).filter((k) => {
      if (layers.dummies.has(k)) return false
      const s = spanOfKey(k)
      return s !== undefined && s[0] <= r && r <= s[1] && (frameIds.has(k) || s[0] === r)
    })
    kidsAt.set(`${f}\0${r}`, out)
    return out
  }
  type Step = { frame: FrameId; key: string } | { frame: FrameId; rank: number; slot: number }
  const paths = new Map<string, Step[]>()
  const pathOfSlot = (rank: number, at: number): Step[] => {
    const memo = paths.get(`${rank}:${at}`)
    if (memo) return memo
    const s = slots[rank]?.[at]
    let out: Step[] = []
    if (s?.kind === 'box') {
      const info = corridors.boxes.get(s.key)
      const chain = ancestry(info?.frame ?? '')
      out = chain.map((f, i) => ({
        frame: f,
        key: i + 1 < chain.length ? frameKey(chain[i + 1] ?? '') : (info?.item ?? s.key),
      }))
    } else if (s?.kind === 'column') {
      const node = nodes[s.node]
      if (node?.kind === 'column') {
        const chain = ancestry(node.frame)
        out = [
          ...chain.slice(0, -1).map((f, i) => ({ frame: f, key: frameKey(chain[i + 1] ?? '') })),
          { frame: node.frame, rank: node.rank, slot: node.slot },
        ]
      }
    }
    paths.set(`${rank}:${at}`, out)
    return out
  }
  // siblings that cannot share an x are told apart in sibling order, and by every sibling between
  const solidKids = new Map<FrameId, string[]>()
  const solid = (f: FrameId): string[] => {
    const memo = solidKids.get(f)
    if (memo) return memo
    const out = (layers.siblings.get(f) ?? []).filter((k) => !layers.dummies.has(k))
    solidKids.set(f, out)
    return out
  }
  const closure = new Map<FrameId, boolean[][]>()
  const leftOf = (f: FrameId, i: number, j: number): boolean => {
    if (i >= j) return false
    let m = closure.get(f)
    if (!m) {
      const kids = solid(f)
      const n = kids.length
      m = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const [ka, kb] = [kids[a] ?? '', kids[b] ?? '']
          const [sa, sb] = [layers.ranks.span.get(ka), layers.ranks.span.get(kb)]
          const stacked =
            sa && sb && (sa[1] < sb[0] || sb[1] < sa[0]) && layers.ranks.ordered(ka, kb)
          const row = m[a]
          if (row) row[b] = !stacked
        }
      }
      for (let len = 2; len < n; len++) {
        for (let a = 0; a + len < n; a++) {
          const b = a + len
          const row = m[a]
          if (!row || row[b]) continue
          for (let k = a + 1; k < b; k++)
            if (row[k] && m[k]?.[b]) {
              row[b] = true
              break
            }
        }
      }
      closure.set(f, m)
    }
    return m[i]?.[j] === true
  }

  /** -1 if the top slot must stand left of the bottom one, 1 if right of it, 0 if the frames leave it open. */
  const forced = (rt: number, st: number, rb: number, sb: number): number => {
    const pt = pathOfSlot(rt, st)
    const pb = pathOfSlot(rb, sb)
    for (let d = 0; ; d++) {
      const a = pt[d]
      const b = pb[d]
      if (!a || !b) return 0
      if ('key' in a && 'key' in b) {
        if (a.key === b.key) continue
        const ia = solid(a.frame).indexOf(a.key)
        const ib = solid(a.frame).indexOf(b.key)
        if (ia < 0 || ib < 0) return 0
        return ia < ib ? (leftOf(a.frame, ia, ib) ? -1 : 0) : leftOf(a.frame, ib, ia) ? 1 : 0
      }
      if ('slot' in a && 'key' in b) return laneSide(a, b.key)
      if ('key' in a && 'slot' in b) return -laneSide(b, a.key)
      return 0
    }
  }
  /** -1 if the column's line stands left of the child, 1 if right of it, 0 if open. */
  const laneSide = (
    lane: { frame: FrameId; rank: number; slot: number },
    child: string,
  ): number => {
    const all = solid(lane.frame)
    const jc = all.indexOf(child)
    if (jc < 0) return 0
    const here = colKids(lane.frame, lane.rank)
    const idx = (k: string) => all.indexOf(k)
    const before = here
      .slice(0, lane.slot)
      .some((c) => c === child || leftOf(lane.frame, jc, idx(c)))
    const beyond = here.slice(lane.slot).some((c) => c === child || leftOf(lane.frame, idx(c), jc))
    return beyond && !before ? -1 : before && !beyond ? 1 : 0
  }

  interface Row {
    elems: (MElem & { key: string })[]
    index: Map<string, number>
  }
  /** The merged order of gap g, from the order of the ports on the sides of boxes. */
  const mergeGap = (g: number, ports: ReadonlyMap<string, readonly string[]>): Row => {
    type El = MElem & { key: string }
    // a block: the ports on one edge of a box, or one line in a column, or a place held for a box or a column with none
    const list = (rank: number, side: 'top' | 'bottom'): { slot: number; elems: El[] }[] => {
      const out: { slot: number; elems: El[] }[] = []
      for (const [s, slot] of (slots[rank] ?? []).entries()) {
        if (slot.kind === 'box') {
          const edge = side === 'top' ? 'bottom' : 'top'
          const elems: El[] = []
          for (const id of ports.get(sideKey(slot.key, edge)) ?? []) {
            const ent = entities.get(id)
            if (ent?.axis !== 'x') continue
            const ref = varKey({ kind: 'port', id })
            elems.push({ key: `${ref}|${g}`, ref, side, slot: s })
          }
          out.push({
            slot: s,
            elems: elems.length > 0 ? elems : [{ key: `m:${g}:${side}:${s}`, side, slot: s }],
          })
        } else {
          const wall = side === 'top' ? 'bottom' : 'top'
          let any = false
          for (const key of columns.get(slot.node) ?? []) {
            const lane = lanes.get(key)
            if (!lane || (lane.win !== wall && lane.wout !== wall)) continue
            any = true
            out.push({ slot: s, elems: [{ key: `l:${key}|${g}`, ref: `l:${key}`, side, slot: s }] })
          }
          if (!any) out.push({ slot: s, elems: [{ key: `m:${g}:${side}:${s}`, side, slot: s }] })
        }
      }
      return out
    }
    const top = g >= 0 ? list(g, 'top') : []
    const bottom = g + 1 <= layers.ranks.max ? list(g + 1, 'bottom') : []
    const topAt = new Map<string, number>()
    for (const [i, b] of top.entries()) for (const e of b.elems) if (e.ref) topAt.set(e.ref, i)
    // a bottom block's key: the median place among the top blocks that its lines come from
    const keys: (number | undefined)[] = bottom.map((blk) => {
      const places: number[] = []
      for (const e of blk.elems) {
        if (!e.ref) continue
        for (const o of occ.get(e.ref) ?? []) {
          for (const step of [1, -1] as const) {
            const v = neighbour(o.line, o.at, step)
            const t = v ? topAt.get(varKey(v)) : undefined
            if (t !== undefined) places.push(t)
          }
        }
      }
      if (places.length === 0) return undefined
      places.sort((p, q) => p - q)
      const m = places.length >> 1
      return places.length % 2 === 1
        ? (places[m] ?? 0)
        : ((places[m - 1] ?? 0) + (places[m] ?? 0)) / 2
    })
    // how many top blocks stand before each bottom one: as many as its key says, but no fewer than
    // those that must stand left of it and no more than lets those that must stand right of it
    // come after, because the frames they are in stand so
    const firstOf = new Map<number, number>()
    const lastOf = new Map<number, number>()
    for (const [i, b] of top.entries()) {
      if (!firstOf.has(b.slot)) firstOf.set(b.slot, i)
      lastOf.set(b.slot, i)
    }
    const topSlots = [...firstOf.keys()]
    const windows = new Map<number, [number, number]>()
    const windowOf = (slot: number): [number, number] => {
      const known = windows.get(slot)
      if (known) return known
      let lo = 0
      let hi = top.length
      for (const ts of topSlots) {
        const f = forced(g, ts, g + 1, slot)
        if (f < 0) lo = Math.max(lo, (lastOf.get(ts) ?? 0) + 1)
        else if (f > 0) hi = Math.min(hi, firstOf.get(ts) ?? top.length)
      }
      windows.set(slot, [lo, hi])
      return [lo, hi]
    }
    const elems: El[] = []
    let t = 0
    for (const [j, b] of bottom.entries()) {
      const k = keys[j]
      const want = k === undefined ? t : Math.floor(k) + 1
      const [lo, hi] = windowOf(b.slot)
      const count = Math.max(t, Math.min(Math.max(want, lo), hi))
      while (t < top.length && t < count) {
        elems.push(...(top[t]?.elems ?? []))
        t++
      }
      elems.push(...b.elems)
    }
    while (t < top.length) {
      elems.push(...(top[t]?.elems ?? []))
      t++
    }
    return { elems, index: new Map(elems.map((e, i) => [e.key, i])) }
  }
  let rows: Row[] = Array.from({ length: gaps }, (_, i) => mergeGap(i - 1, provisional))

  // ---- 3. the lines in each row, top to bottom
  const reachOf = (rs: Row[], g: number, side: 'top' | 'bottom', from: number, to: number) => {
    const row = rs[g + 1]
    if (!row) return undefined
    let lo = Number.POSITIVE_INFINITY
    let hi = Number.NEGATIVE_INFINITY
    for (const [i, e] of row.elems.entries()) {
      if (e.side === side && e.slot >= from && e.slot <= to) {
        lo = Math.min(lo, i)
        hi = Math.max(hi, i)
      }
    }
    return lo > hi ? undefined : ([lo, hi] as [number, number])
  }
  const cellRange = (rs: Row[], id: number): [number, number] => {
    const node = nodes[id]
    const row = node?.kind === 'cell' ? rs[node.gap + 1] : undefined
    const full: [number, number] = [0, Math.max(0, (row?.elems.length ?? 1) - 1)]
    if (node?.kind !== 'cell' || !row) return full
    const a = node.above ? reachOf(rs, node.gap, 'top', node.above[0], node.above[1]) : undefined
    const b = node.below ? reachOf(rs, node.gap, 'bottom', node.below[0], node.below[1]) : undefined
    const lo = Math.min(a?.[0] ?? Number.POSITIVE_INFINITY, b?.[0] ?? Number.POSITIVE_INFINITY)
    const hi = Math.max(a?.[1] ?? Number.NEGATIVE_INFINITY, b?.[1] ?? Number.NEGATIVE_INFINITY)
    return lo > hi ? full : [lo, hi]
  }
  /** A lane's two ends: on a wall at an element of the merged order, or run out to the side of its cell. */
  const endsOf = (rs: Row[], lane: Lane): { wall: Side; at?: number }[] => {
    const node = nodes[lane.node]
    if (node?.kind !== 'cell') return []
    const row = rs[node.gap + 1]
    const chain = chains.get(lane.line) ?? []
    const me = chain.findIndex((v) => v.kind === 'lane' && v.key === lane.key)
    const elementAt = (step: 1 | -1) => {
      for (let k = me + step; k >= 0 && k < chain.length; k += step) {
        const v = chain[k]
        if (!v || axisOf(v) !== 'x') continue
        const hit = placesOf(v).find((p) => p.gap === node.gap)
        return hit ? row?.index.get(`${varKey(v)}|${node.gap}`) : undefined
      }
      return undefined
    }
    const toward = (wall: Side, step: 1 | -1) =>
      wall === 'top' || wall === 'bottom' ? { wall, at: elementAt(step) } : { wall }
    return [toward(lane.win, -1), toward(lane.wout, 1)]
  }
  const spans = new Map<string, readonly [number, number]>()
  const intervalsOf = (rs: Row[]) => {
    for (const lane of lanes.values()) {
      if (!lane.used) continue
      const node = nodes[lane.node]
      if (node?.kind !== 'cell') continue
      const [cLo, cHi] = cellRange(rs, lane.node)
      let lo = Number.POSITIVE_INFINITY
      let hi = Number.NEGATIVE_INFINITY
      for (const e of endsOf(rs, lane)) {
        if (e.at !== undefined) {
          lo = Math.min(lo, e.at)
          hi = Math.max(hi, e.at)
        } else {
          if (e.wall === 'left' || e.wall === 'top' || e.wall === 'bottom') lo = Math.min(lo, cLo)
          if (e.wall === 'right' || e.wall === 'top' || e.wall === 'bottom') hi = Math.max(hi, cHi)
        }
      }
      spans.set(lane.key, [Math.max(cLo, lo), Math.min(cHi, hi)])
    }
  }
  intervalsOf(rows)
  const decided = new Map<string, number>()
  const cells = new Map<number, string[]>()
  const cellCost = (a: Lane, b: Lane): number => {
    const [sa, sb] = [spans.get(a.key), spans.get(b.key)]
    if (!sa || !sb) return 0
    let cost = 0
    const topEnd = (l: Lane) => {
      const e = endsOf(rows, l).find((x) => x.wall === 'top' && x.at !== undefined)
      return e?.at
    }
    const bottomEnd = (l: Lane) => {
      const e = endsOf(rows, l).find((x) => x.wall === 'bottom' && x.at !== undefined)
      return e?.at
    }
    const tb = topEnd(b)
    if (tb !== undefined && tb > sa[0] && tb < sa[1]) cost++
    const ba = bottomEnd(a)
    if (ba !== undefined && ba > sb[0] && ba < sb[1]) cost++
    if (a.run !== b.run) {
      const lo = Math.min(a.run, b.run)
      const was = decided.get(`${lo}|${Math.max(a.run, b.run)}`)
      if (was !== undefined && (a.run === lo ? 1 : -1) !== was) cost += 1000
    }
    return cost
  }
  for (const id of nodeIds) {
    const node = nodes[id]
    if (node?.kind !== 'cell') continue
    const list = (inNode.get(id) ?? []).sort((p, q) => compare(p.key, q.key))
    const byKey = new Map(list.map((l) => [l.key, l]))
    const cost = (x: string, y: string) => {
      const [a, b] = [byKey.get(x), byKey.get(y)]
      return a && b ? cellCost(a, b) : 0
    }
    const { order } = laneOrder(
      list.map((l) => l.key),
      cost,
    )
    cells.set(id, order)
    for (const [i, ka] of order.entries()) {
      for (const kb of order.slice(i + 1)) {
        crossings += cost(ka, kb)
        const [a, b] = [byKey.get(ka), byKey.get(kb)]
        if (a && b && a.run !== b.run) {
          const lo = Math.min(a.run, b.run)
          decided.set(`${lo}|${Math.max(a.run, b.run)}`, a.run === lo ? 1 : -1)
        }
      }
    }
  }

  // ---- 4. the ports of each side, in order
  const laneNo = (key: string, fromTop: boolean): { cell: number; no: number } | undefined => {
    const lane = lanes.get(key)
    const order = lane ? cells.get(lane.node) : undefined
    if (!lane || !order) return undefined
    const i = order.indexOf(key)
    return { cell: lane.node, no: fromTop ? i : order.length - 1 - i }
  }
  const finalPorts = new Map<string, string[]>()
  for (const [k, list] of provisional) {
    const ents = list.map((id) => entities.get(id)).filter((e): e is Entity => e !== undefined)
    const first = ents[0]
    if (!first) continue
    if (first.axis === 'x') {
      // a port's first lane and the stretch of the merged order it spans
      const info = new Map(
        ents.map((e) => {
          const end = e.ends[0]
          const chain = end ? (chains.get(end.line) ?? []) : []
          const v = end ? chain[end.end === 'a' ? 1 : chain.length - 2] : undefined
          const lane = v?.kind === 'lane' ? lanes.get(v.key) : undefined
          const no = lane ? laneNo(lane.key, e.side === 'bottom') : undefined
          const r = slotRank(e.box)
          const gap = e.side === 'bottom' ? r : r - 1
          const at = rows[gap + 1]?.index.get(`${varKey({ kind: 'port', id: e.id })}|${gap}`)
          return [e.id, { no, span: lane ? spans.get(lane.key) : undefined, at }] as const
        }),
      )
      const cost = (x: string, y: string) => {
        const [a, b] = [info.get(x), info.get(y)]
        if (!a || !b || !a.no || !b.no || a.no.cell !== b.no.cell) return 0
        let c = 0
        if (
          a.no.no < b.no.no &&
          b.at !== undefined &&
          a.span &&
          b.at > a.span[0] &&
          b.at < a.span[1]
        )
          c++
        if (
          b.no.no < a.no.no &&
          a.at !== undefined &&
          b.span &&
          a.at > b.span[0] &&
          a.at < b.span[1]
        )
          c++
        return c
      }
      const { order } = laneOrder(list, cost)
      finalPorts.set(k, order)
    } else {
      const exitRank = (e: Entity) => {
        const end = e.ends[0]
        const route = end ? routes.routes.get(end.line) : undefined
        if (!end || !route) return { rank: 1, near: 0, id: e.id }
        const i = end.end === 'a' ? 1 : route.nodes.length - 2
        const w = route.walls[i]
        const wall = end.end === 'a' ? w?.out : w?.in
        const entry = end.end === 'a' ? w?.in : w?.out
        const key = `${end.line}@${i - 1}`
        const column = nodes[route.nodes[i] ?? 0] ? columns.get(route.nodes[i] ?? 0) : undefined
        const at = column?.indexOf(key) ?? 0
        const n = column?.length ?? 1
        const fromLeft = entry === 'left'
        const near = fromLeft ? at : n - 1 - at
        const rank = wall === 'top' ? 0 : wall === 'bottom' ? 2 : wall === entry ? 3 : 1
        return { rank, near: rank === 2 ? -near : near, id: e.id }
      }
      const ranked = new Map(ents.map((e) => [e.id, exitRank(e)]))
      finalPorts.set(
        k,
        [...list].sort((p, q) => {
          const [a, b] = [ranked.get(p), ranked.get(q)]
          if (!a || !b) return 0
          return a.rank - b.rank || (a.rank === 1 ? 0 : a.near - b.near) || compare(a.id, b.id)
        }),
      )
    }
  }
  for (const [k, list] of finalPorts) provisional.set(k, list)
  rows = Array.from({ length: gaps }, (_, i) => mergeGap(i - 1, provisional))
  spans.clear()
  intervalsOf(rows)
  if (process.env['SERIAL_DEBUG2']) {
    for (const [gi, row] of rows.entries()) {
      for (const [i, e] of row.elems.entries()) {
        for (const [j, f] of row.elems.entries()) {
          if (e.side !== 'top' || f.side !== 'bottom') continue
          const fo = forced(gi - 1, e.slot, gi, f.slot)
          if ((fo < 0 && j < i) || (fo > 0 && i < j))
            console.error('VIOLATION gap', gi - 1, e.ref ?? e.key, f.ref ?? f.key, fo)
        }
      }
    }
  }

  return {
    entities,
    lanes,
    chains,
    joined,
    columns,
    cells,
    ports: provisional,
    merged: rows.map((r) => r.elems.map(({ key: _key, ...e }) => e)),
    spans,
    reach: (gap, side, from, to) => reachOf(rows, gap, side, from, to),
    places: placesOf,
    free: (gap, top, bottom) => forced(gap, top, gap + 1, bottom) === 0,
    crossings,
  }
}
