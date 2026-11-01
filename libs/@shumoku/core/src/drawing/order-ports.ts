// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey, splitKey } from '../structure/keys.js'
import { type Anchor, along, turnAround } from './global.js'
import { type Spacing, slotRow } from './kin.js'
import type { Point } from './metrics.js'
import { type Path, type Paths, passing, posOf, type Slot } from './order-paths.js'
import { lineEnd, parseLineEnd } from './problem.js'
import type { RouteRooms } from './rooms.js'
import type { Cell } from './space.js'
import { EPS } from './tolerance.js'

/** One end of a line, as it stands at a box. */
interface Member {
  line: string
  end: 'a' | 'b'
  anchor: Anchor
  est: Point
}

/**
 * The ports that stand together on one side of one box, and the places they stand at, in order
 * along the cell's perimeter. The ports of a side keep a slot from each other, so they stand in a
 * row about where the lines were estimated to leave, not on one point: on one point no two of
 * their chords could cross, and the order of the ports would count for nothing.
 */
export interface PortGroup {
  keys: string[]
  places: number[]
  own: Map<string, number>
  out: number
  slot: number
}

/** The third stage's input: the ports of the lines and how they are grouped. Never written after. */
export interface PortGrid {
  /** Every port end that stands at a box, by the side of the box it stands at. */
  groups: Map<string, Member[]>
  /** Those sides that have two or more. */
  portGroups: PortGroup[]
  slots: Spacing['slots']
  rooms?: ReadonlyMap<string, RouteRooms>
}

/**
 * Where the ports stand and which of them have no room. Each stage that changes them gives a new
 * one, except the climb, which owns the one it is given and gives both back as they were when it
 * takes a change back.
 */
export interface Ports {
  /** Where the ports stand along the perimeter of their cells, where that is not where they were. */
  pos: Map<string, number>
  /** The ports that, in the order their side has, have no room within the window their line leaves them. */
  unfit: Set<string>
}

export const noPorts = (): Ports => ({ pos: new Map(), unfit: new Set() })

const copyOf = (ports: Ports): Ports => ({ pos: new Map(ports.pos), unfit: new Set(ports.unfit) })

export function portGridOf(
  g: Paths,
  { slots }: Pick<Spacing, 'slots'>,
  rooms?: ReadonlyMap<string, RouteRooms>,
): PortGrid {
  const groups = new Map<string, Member[]>()
  for (const { route, path } of g.lines) {
    for (const [end, anchor, j] of [
      ['a', route.from, 0],
      ['b', route.to, path.slots.length - 1],
    ] as const) {
      const key = joinKey([anchor.cell, anchor.box, anchor.out])
      groups.set(key, [
        ...(groups.get(key) ?? []),
        { line: path.line, end, anchor, est: path.slots[j]?.est ?? anchor.lead },
      ])
    }
  }
  const portGroups = [...groups.values()]
    .filter((m) => m.length >= 2)
    .map((m) => {
      const first = m[0] as Member
      const { out } = first.anchor
      const cell = g.space.cells[first.anchor.cell] as Cell
      const across = out === 0 || out === 2
      const coordOf = (p: Point) => (across ? p.y : p.x)
      const pointAt = (v: number): Point =>
        across ? { x: first.anchor.lead.x, y: v } : { x: v, y: first.anchor.lead.y }
      const perimeter = (v: number) => along(cell, turnAround(out), pointAt(v))
      const slot = slots.get(first.anchor.box) ?? 0
      const valid = m.map((e) => e.anchor.span).filter((sp) => sp[0] <= sp[1] + EPS)
      const [lo, hi] =
        valid.length > 0
          ? [Math.min(...valid.map((sp) => sp[0])), Math.max(...valid.map((sp) => sp[1]))]
          : across
            ? [cell.y0, cell.y1]
            : [cell.x0, cell.x1]
      const mean = m.reduce((sum, e) => sum + coordOf(e.est), 0) / m.length
      const row = slotRow(m.length, slot)
      const start = Math.max(lo, Math.min(mean - row.length / 2, hi - row.length))
      return {
        keys: m.map((e) => lineEnd(e.line, e.end)),
        places: row.offsets.map((offset) => perimeter(start + offset)).sort((p, q) => p - q),
        own: new Map(m.map((e) => [lineEnd(e.line, e.end), perimeter(coordOf(e.est))])),
        out,
        slot,
      }
    })
  return { groups, portGroups, slots, rooms }
}

/** The slot of a line at the first door from a port, if it has one: where the line leaves the cell. */
export function firstSlot(
  g: Paths,
  key: string,
): { path: Path; j: number; door: number } | undefined {
  const { line, end } = parseLineEnd(key)
  const path = g.byLine.get(line)?.path
  if (!path) return undefined
  const j = end === 'a' ? 1 : path.slots.length - 2
  const door = path.slots[j]?.door
  return door === undefined ? undefined : { path, j, door }
}

const cellOfEnd = (g: Paths, key: string): number => {
  const { line, end } = parseLineEnd(key)
  const path = g.byLine.get(line)?.path as Path
  return end === 'a' ? (path.cells[0] as number) : (path.cells.at(-1) as number)
}

/** Where a line that goes through no door leaves its cell: by the port at its other end, in the same cell. */
const otherEnd = (g: Paths, ports: Ports, key: string): number => {
  const { line, end } = parseLineEnd(key)
  const path = g.byLine.get(line)?.path
  const slot = end === 'a' ? path?.slots.at(-1) : path?.slots[0]
  return slot ? posOf(g, ports.pos, slot, cellOfEnd(g, key)) : 0
}

/** The room a port's line has where it leaves its box: the room of the run that starts at it. */
const windowOf = ({ rooms }: PortGrid, key: string): [number, number] => {
  const { line, end } = parseLineEnd(key)
  const runs = rooms?.get(line)?.runs
  const room = end === 'a' ? runs?.[0] : runs?.at(-1)
  return room ? [room.lo, room.hi] : [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
}

/**
 * Puts the ports of a group in the places along the side, in the order given, and says which of
 * them that order leaves no room. Along the side, from the low end, each port stands a slot from
 * the one before or at the start of its window, whichever is later, and must stand before its
 * window ends; a port whose line leaves by a joint has the whole side for a window. The fewest
 * ports to take out of the row for the rest to stand so are found by keeping, for each number
 * kept, the earliest the row can end; of two ways to keep as many, the one that keeps the earlier
 * port. The ports taken out are `unfit`: the order is not changed for them, which would cross
 * more; their lines are to be laid again so that a joint frees the port of its door.
 *
 * Writes into the `ports` it is given.
 */
function settle(grid: PortGrid, ports: Ports, group: PortGroup, sorted: readonly string[]) {
  for (const key of group.keys) ports.unfit.delete(key)
  const forward = group.out === 1 || group.out === 2
  const row = forward ? sorted : [...sorted].reverse()
  const { slot } = group
  /** For each count kept so far, the earliest the last kept stands, and whether each port was kept to reach it. */
  let best: (number | undefined)[] = [Number.NEGATIVE_INFINITY]
  const kept: boolean[][] = []
  for (const key of row) {
    const [lo, hi] = windowOf(grid, key)
    const next: (number | undefined)[] = [...best]
    const took: boolean[] = []
    for (const [k, at] of best.entries()) {
      if (at === undefined) continue
      const here = at === Number.NEGATIVE_INFINITY ? lo : Math.max(lo, at + slot)
      if (here > hi + EPS) continue
      const was = next[k + 1]
      if (was === undefined || here < was - EPS) {
        next[k + 1] = here
        took[k + 1] = true
      }
    }
    kept.push(took)
    best = next
  }
  let k = best.length - 1
  while (k > 0 && best[k] === undefined) k--
  for (let i = row.length - 1; i >= 0; i--) {
    const key = row[i] as string
    if (kept[i]?.[k]) k--
    else ports.unfit.add(key)
  }
  for (const [i, key] of sorted.entries()) ports.pos.set(key, group.places[i] ?? 0)
}

/**
 * The ports of one group in the order their chords cross none: a port's chord runs from its
 * place to where the line leaves the cell, the door and its place in the order there. The chords
 * of ports that stand in a row cross none if the ones whose lines leave below the row come
 * first, the nearest first, then the ones that leave above it, the nearest first, so the chords
 * lie inside one another. Nothing but the orders at the doors decides it.
 *
 * Writes into the `ports` it is given.
 */
export function deriveGroup(
  g: Paths,
  grid: PortGrid,
  order: ReadonlyMap<number, string[]>,
  ports: Ports,
  group: PortGroup,
) {
  const lo = group.places[0] ?? 0
  const exits = new Map(
    group.keys.map((key) => {
      const f = firstSlot(g, key)
      const exit = f
        ? posOf(
            g,
            ports.pos,
            f.path.slots[f.j] as Slot,
            cellOfEnd(g, key),
            order.get(f.door),
            passing(f.path, f.j),
          )
        : otherEnd(g, ports, key)
      return [key, exit] as const
    }),
  )
  const exit = (key: string) => exits.get(key) ?? lo
  const above = (key: string) => (exit(key) < lo ? 0 : 1)
  const sorted = [...group.keys].sort(
    (p, q) => above(p) - above(q) || exit(q) - exit(p) || compare(p, q),
  )
  settle(grid, ports, group, sorted)
}

/** The ports in the order the lines were estimated to leave in, which is where they stood. */
export function keepPorts(grid: PortGrid, from: Ports): Ports {
  const ports = copyOf(from)
  for (const group of grid.portGroups) {
    const sorted = [...group.keys].sort(
      (p, q) => (group.own.get(p) ?? 0) - (group.own.get(q) ?? 0) || compare(p, q),
    )
    settle(grid, ports, group, sorted)
  }
  return ports
}

/** The ports of every group, each in the order that crosses none with the orders at the doors. */
export function derivePorts(
  g: Paths,
  grid: PortGrid,
  order: ReadonlyMap<number, string[]>,
  from: Ports,
): Ports {
  const ports = copyOf(from)
  for (const group of grid.portGroups) deriveGroup(g, grid, order, ports, group)
  return ports
}

/**
 * The ports that have no room once the rows of the sides are taken together: a straight line
 * (one run) makes its two ports one value, so the rows of its two sides are one chain of orders,
 * and each row may have room by itself while the chain has none. Over all the rows and the
 * lines that join them, the earliest each port can stand is found from the start of its window
 * and the ports before it, and the latest from the end of its window and the ports after it;
 * where the earliest passes the latest the chain does not fit. Of the ports that join two rows
 * in such a chain, the one that falls shortest is given up: laid again with a joint, its line is
 * no longer straight and the rows come apart. One at a time, since what remains is settled again.
 */
export function unfitAcross(g: Paths, grid: PortGrid, pos: ReadonlyMap<string, number>): string[] {
  // A row is one side of one box, through every cell the side faces, the cells in the order
  // they lie along the side; in a cell, the ports in the order of their places.
  const sides = new Map<string, { cell: number; at: number; keys: string[]; slot: number }[]>()
  for (const [groupKey, members] of grid.groups) {
    const first = members[0]
    if (!first) continue
    const forward = first.anchor.out === 1 || first.anchor.out === 2
    const cell = g.space.cells[first.anchor.cell] as Cell
    const across = first.anchor.out === 0 || first.anchor.out === 2
    const byPlace = [...members]
      .map((m) => lineEnd(m.line, m.end))
      .sort((p, q) => (pos.get(p) ?? 0) - (pos.get(q) ?? 0) || compare(p, q))
    const [, box = '', out = ''] = splitKey(groupKey)
    const side = joinKey([box, out])
    sides.set(side, [
      ...(sides.get(side) ?? []),
      {
        cell: first.anchor.cell,
        at: across ? cell.y0 : cell.x0,
        keys: forward ? byPlace : [...byPlace].reverse(),
        slot: grid.slots.get(first.anchor.box) ?? 0,
      },
    ])
  }
  const rows = [...sides.values()].map((parts) => {
    const ordered = [...parts].sort((p, q) => p.at - q.at || p.cell - q.cell)
    return { keys: ordered.flatMap((p) => p.keys), slot: ordered[0]?.slot ?? 0 }
  })
  const index = new Map<string, number>()
  for (const row of rows) for (const key of row.keys) index.set(key, index.size)
  const n = index.size
  if (n === 0) return []
  // the two ends of a straight line are one value
  const parent = Array.from({ length: n }, (_, i) => i)
  const joinRoot = (i: number): number => {
    let r = i
    while (parent[r] !== r) r = parent[r] ?? r
    let c = i
    while (c !== r) {
      const next = parent[c] ?? r
      parent[c] = r
      c = next
    }
    return r
  }
  const joined = new Set<string>()
  for (const { route } of g.lines) {
    if (route.runs.length !== 1) continue
    const a = index.get(lineEnd(route.line, 'a'))
    const b = index.get(lineEnd(route.line, 'b'))
    if (a === undefined || b === undefined) continue
    parent[joinRoot(a)] = joinRoot(b)
    joined.add(lineEnd(route.line, 'a'))
    joined.add(lineEnd(route.line, 'b'))
  }
  const lo = new Array<number>(n).fill(Number.NEGATIVE_INFINITY)
  const hi = new Array<number>(n).fill(Number.POSITIVE_INFINITY)
  for (const [key, i] of index) {
    const [a, b] = windowOf(grid, key)
    const r = joinRoot(i)
    lo[r] = Math.max(lo[r] ?? 0, a)
    hi[r] = Math.min(hi[r] ?? 0, b)
  }
  const edges: { from: number; to: number; d: number }[] = []
  for (const row of rows) {
    for (const [k, key] of row.keys.entries()) {
      const next = row.keys[k + 1]
      if (next === undefined) continue
      edges.push({
        from: joinRoot(index.get(key) ?? 0),
        to: joinRoot(index.get(next) ?? 0),
        d: row.slot,
      })
    }
  }
  // the earliest and the latest, relaxed until nothing moves; a ring that grows without end is
  // one that no position satisfies, and is left at the point it reached
  const early = [...lo]
  const late = [...hi]
  for (let pass = 0; pass <= n; pass++) {
    let moved = false
    for (const e of edges) {
      const need = (early[e.from] ?? 0) + e.d
      if (Number.isFinite(need) && need > (early[e.to] ?? 0) + EPS) {
        early[e.to] = need
        moved = true
      }
      const cap = (late[e.to] ?? 0) - e.d
      if (Number.isFinite(cap) && cap < (late[e.from] ?? 0) - EPS) {
        late[e.from] = cap
        moved = true
      }
    }
    if (!moved) break
  }
  // the components, by the rows and the joins; the shortfall of each
  const comp = Array.from({ length: n }, (_, i) => joinRoot(i))
  const merge = (a: number, b: number) => {
    const ra = comp[a] ?? a
    const rb = comp[b] ?? b
    for (let i = 0; i < n; i++) if (comp[i] === rb) comp[i] = ra
  }
  for (const e of edges) merge(e.from, e.to)
  const short = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const r = joinRoot(i)
    const gap = (early[r] ?? 0) - (late[r] ?? 0)
    if (gap > EPS) short.set(comp[r] ?? r, Math.max(short.get(comp[r] ?? r) ?? 0, gap))
  }
  const out: string[] = []
  for (const [c] of short) {
    let pick: { key: string; gap: number; width: number } | undefined
    for (const [key, i] of index) {
      if (!joined.has(key) || (comp[joinRoot(i)] ?? 0) !== c) continue
      const r = joinRoot(i)
      const gap = (early[r] ?? 0) - (late[r] ?? 0)
      const [a, b] = windowOf(grid, key)
      const width = b - a
      if (
        !pick ||
        gap > pick.gap + EPS ||
        (Math.abs(gap - pick.gap) <= EPS &&
          (width < pick.width - EPS ||
            (Math.abs(width - pick.width) <= EPS && compare(key, pick.key) < 0)))
      ) {
        pick = { key, gap, width }
      }
    }
    if (pick) out.push(pick.key)
  }
  return out
}
