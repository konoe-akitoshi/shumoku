// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type Corridors, columnKey, opposite } from './corridors.js'
import { laneOrder } from './crossing.js'
import type { Layers } from './layers.js'
import { portId } from './ports.js'
import { boxKey, type End, type Line, linesById, type Problem } from './problem.js'
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

export interface Tracks {
  entities: ReadonlyMap<string, Entity>
  lanes: ReadonlyMap<string, Lane>
  /** For each line, its chain of coordinates in order. */
  chains: ReadonlyMap<string, readonly Var[]>
  /** Pairs of coordinates in a chain that are one and the same (a run carried on, level ports). */
  joined: readonly (readonly [string, string])[]
  /** The vertical runs of each column, left to right. */
  columns: ReadonlyMap<number, readonly string[]>
  /** The ports on each side of a box (`box\0side`), in order along the side. */
  ports: ReadonlyMap<string, readonly string[]>
  /** What the order of the runs in the columns costs in crossings. */
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
  const { nodes, doors } = corridors
  const byLine = linesById(problem)
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

  // ---- 2. the ports of each side, in order
  // A port on a top or bottom edge is told by where its line goes on from the row beside the box:
  // along the row to a column of the box's own rank (a), down or up to the next rank (b), out to
  // the side of a frame (c). Those that go left stand left, in the order of where they go, those
  // that go right stand right, and those that go to the next rank stand between, in the order of
  // that rank. Only what the edge itself and its own rank say is read.
  const sideKey = (box: string, side: Side) => `${box} ${side}`
  const portOrder = new Map<string, string[]>()
  for (const e of [...entities.values()].sort((p, q) => compare(p.id, q.id))) {
    const k = sideKey(e.box, e.side)
    portOrder.set(k, [...(portOrder.get(k) ?? []), e.id])
  }
  /** Where the line of an end goes on from the cell beside its box. */
  const heading = (ent: Entity): { group: 0 | 1 | 2 | 3 | 4; at: number } => {
    const first = ent.ends[0]
    const route = first ? routes.routes.get(first.line) : undefined
    if (!first || !route) return { group: 2, at: 0 }
    const last = route.nodes.length - 1
    const a = first.end === 'a'
    const step = a ? 1 : -1
    const own = corridors.boxes.get(ent.box)?.rank ?? 0
    const mine = corridors.slotOf.get(ent.box) ?? 0
    for (let i = a ? 1 : last - 1; i > 0 && i < last; i += step) {
      const node = nodes[route.nodes[i] ?? 0]
      const wall = a ? route.walls[i]?.out : route.walls[i]?.in
      if (node?.kind === 'cell') {
        if (wall === 'left') return { group: 0, at: 0 }
        if (wall === 'right') return { group: 4, at: 0 }
        continue
      }
      const rank =
        node?.kind === 'column'
          ? node.rank
          : (corridors.boxes.get(node?.kind === 'side' ? node.box : '')?.rank ?? own)
      const at =
        corridors.slotOf.get(
          node?.kind === 'column'
            ? columnKey(route.nodes[i] ?? 0)
            : node?.kind === 'side'
              ? node.box
              : '',
        ) ?? 0
      if (rank !== own) return { group: 2, at }
      return at < mine ? { group: 1, at } : { group: 3, at }
    }
    return { group: 2, at: 0 }
  }
  const finalPorts = new Map<string, string[]>()
  for (const [k, list] of portOrder) {
    const ents = list.map((id) => entities.get(id)).filter((e): e is Entity => e !== undefined)
    const firstEnt = ents[0]
    if (!firstEnt) continue
    if (firstEnt.axis === 'x') {
      const heads = new Map(ents.map((e) => [e.id, heading(e)]))
      finalPorts.set(
        k,
        [...list].sort((p, q) => {
          const [a, b] = [heads.get(p), heads.get(q)]
          if (!a || !b) return 0
          return a.group - b.group || a.at - b.at || compare(p, q)
        }),
      )
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

  return { entities, lanes, chains, joined, columns, ports: finalPorts, crossings }
}
