// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import {
  along,
  type Dir,
  type GlobalRoute,
  type GlobalRoutes,
  replay,
  SIDE,
  turnAround,
} from './global.js'
import type { Spacing } from './kin.js'
import type { Point } from './metrics.js'
import { lineEnd } from './problem.js'
import type { RouteRooms } from './rooms.js'
import type { Cell, Space } from './space.js'

/** Where a line is as it passes through a cell: at a door, or at the port it starts or ends at. */
export interface Slot {
  /** For a port, which end of which line it is, such as `link:000001.a`. */
  port?: string
  door?: number
  /** For a port: its place along the perimeter of the cell it stands in. */
  pos?: number
  /** Where it was estimated to cross the door. */
  est: Point
}

/**
 * A route as the places it passes: slot `k` and `k + 1` are the two ends of the chord across
 * cell `k`. A run that goes straight on through several doors is one thing, not one for each
 * door: it lies on one line, so the order it has among the others is one and the same at every
 * door it goes through. `first` gives for each slot the first slot of the run it belongs to,
 * which is what names it, and `room` for such a first slot where across its heading the run may
 * lie, so far as the doors it goes through allow.
 */
export interface Path {
  line: string
  slots: Slot[]
  cells: number[]
  first: number[]
  room: Map<number, [number, number]>
}

function pathOf(space: Space, r: GlobalRoute, rooms?: RouteRooms): Path {
  const { hops, last } = replay(space, r)
  const cells = [r.from.cell, ...r.steps.map((s) => s.into)]
  const tail = space.cells[last.cell] as Cell
  const first = Array.from({ length: r.steps.length + 2 }, (_, j) => j)
  const room = new Map<number, [number, number]>()
  for (const [i, run] of r.runs.entries()) {
    if (run.hops.length === 0) continue
    const at = Math.min(...run.hops) + 1
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const h of run.hops) {
      first[h + 1] = at
      const d = space.doors[r.steps[h]?.door ?? -1]
      if (!d) continue
      lo = Math.max(lo, d.reach[0])
      hi = Math.min(hi, d.reach[1])
    }
    // The rooms the lines are placed in are the room it has, where they are known.
    const known = rooms?.runs[i]
    room.set(at, known ? [known.lo, known.hi] : [lo, hi])
  }
  return {
    line: r.line,
    cells,
    first,
    room,
    slots: [
      {
        port: lineEnd(r.line, 'a'),
        pos: along(space.cells[r.from.cell] as Cell, turnAround(r.from.out), r.from.lead),
        est: r.from.lead,
      },
      ...hops.map((h) => ({ door: h.door.id, est: h.leave })),
      {
        port: lineEnd(r.line, 'b'),
        pos: along(tail, turnAround(r.to.out), r.to.lead),
        est: r.to.lead,
      },
    ],
  }
}

/**
 * A line at a door. A line may go through one door twice, up a column and back down it, and a run
 * goes through several doors, so what is ordered is a run's passing, named by the line and the
 * first slot of the run in its route; it is the same name at every door the run goes through.
 */
export interface Passing {
  line: string
  /** The first slot of the run in its route. */
  step: number
}

export const passingOf = (path: Path, j: number): Passing => ({
  line: path.line,
  step: path.first[j] ?? j,
})

/** The name of a passing, for a map or a comparison; nothing parses it back. */
export const passingName = ({ line, step }: Passing): string => `${line}@${step}`

/** The name of the passing of slot `j` of a path. */
export const passing = (path: Path, j: number): string => passingName(passingOf(path, j))

/** What a run is, to the order: where it goes through doors, and where across it may lie. */
export interface Piece {
  id: string
  /** The index of its line's path. */
  path: number
  /** Every slot it goes through, a door each. */
  slots: number[]
  /** The doors that have an order, each with the slot of this run's there. */
  doors: Map<number, number>
  room: [number, number]
}

/** A line's route with the places it passes. */
export interface Line {
  route: GlobalRoute
  path: Path
}

/** The first stage of the order: what the routes pass, read once and never written after. */
export interface Paths {
  space: Space
  /** The lines, in the order of their ids. */
  lines: Line[]
  byLine: Map<string, Line>
  /** The runs (passings), by name: a run is one, however many doors it goes through. */
  pieces: Map<string, Piece>
  /** The runs at each door. */
  at: Map<number, Piece[]>
  /** Where each run was estimated to cross each door, along the door. */
  coordAt: Map<number, Map<string, number>>
  /** The pitch of two passings, which are of lines. */
  apart(a: string | undefined, b: string | undefined): number
}

export function pathsOf(
  space: Space,
  routes: GlobalRoutes,
  { pitch }: Pick<Spacing, 'pitch'>,
  rooms?: ReadonlyMap<string, RouteRooms>,
): Paths {
  const lines = [...routes.routes.values()]
    .sort((p, q) => compare(p.line, q.line))
    .map((r) => ({ route: r, path: pathOf(space, r, rooms?.get(r.line)) }))
  const byLine = new Map(lines.map((p) => [p.path.line, p]))
  const coordAt = new Map<number, Map<string, number>>()
  for (const { path } of lines) {
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      const d = space.doors[s.door]
      const m = coordAt.get(s.door) ?? new Map<string, number>()
      m.set(passing(path, j), d?.normal === 'x' ? s.est.y : s.est.x)
      coordAt.set(s.door, m)
    }
  }
  const pieces = new Map<string, Piece>()
  const at = new Map<number, Piece[]>()
  for (const [pi, { path }] of lines.entries()) {
    for (const [j, s] of path.slots.entries()) {
      if (s.door === undefined) continue
      const id = passing(path, j)
      let piece = pieces.get(id)
      if (!piece) {
        piece = {
          id,
          path: pi,
          slots: [],
          doors: new Map(),
          room: path.room.get(path.first[j] ?? j) ?? [
            Number.NEGATIVE_INFINITY,
            Number.POSITIVE_INFINITY,
          ],
        }
        pieces.set(id, piece)
      }
      piece.slots.push(j)
      piece.doors.set(s.door, j)
      at.set(s.door, [...(at.get(s.door) ?? []), piece])
    }
  }
  const lineOf = (id: string | undefined) =>
    lines[pieces.get(id ?? '')?.path ?? -1]?.path.line ?? ''
  return {
    space,
    lines,
    byLine,
    pieces,
    at,
    coordAt,
    apart: (a, b) => pitch(lineOf(a), lineOf(b)),
  }
}

/** Which way the perimeter of a cell runs along a door on `side`, against the door's own low-to-high. */
export const sgn = (side: Dir): 1 | -1 => (side === 3 || side === 0 ? 1 : -1)

/** Which side of a cell a door is on. */
export function sideIn({ space }: Paths, cell: number, door: number): Dir {
  const side = (space.cells[cell] as Cell).doors.find((d) => d.door === door)?.side ?? 'top'
  return SIDE[side]
}

/** The stretch of a cell's perimeter that a door covers, low to high, and the side it is on. */
function interval(g: Paths, cell: number, door: number): [number, number, Dir] {
  const d = g.space.doors[door]
  const c = g.space.cells[cell] as Cell
  const side = sideIn(g, cell, door)
  if (!d) return [0, 0, side]
  const [p0, p1] =
    d.normal === 'x'
      ? [
          { x: d.at, y: d.lo },
          { x: d.at, y: d.hi },
        ]
      : [
          { x: d.lo, y: d.at },
          { x: d.hi, y: d.at },
        ]
  const a = along(c, side, p0)
  const b = along(c, side, p1)
  return [Math.min(a, b), Math.max(a, b), side]
}

/**
 * The place of a slot along a cell's perimeter. A port is where it stands (`ports`, where that is
 * not where it was). A door's lines are where they were estimated to cross it, taken in the order
 * given (`ranked`, from the low end of the door) and held a pitch apart, so that an order is a
 * place without being an even spread over the door, which would put them nowhere near the ports
 * they are set against.
 */
export function posOf(
  g: Paths,
  ports: ReadonlyMap<string, number>,
  slot: Slot,
  cell: number,
  ranked?: readonly string[],
  line?: string,
): number {
  if (slot.door === undefined) {
    return (slot.port ? ports.get(slot.port) : undefined) ?? slot.pos ?? 0
  }
  const d = g.space.doors[slot.door]
  const c = g.space.cells[cell] as Cell
  const side = sideIn(g, cell, slot.door)
  const at = (v: number) =>
    along(c, side, d?.normal === 'x' ? { x: d.at, y: v } : { x: v, y: d?.at ?? 0 })
  const m = g.coordAt.get(slot.door)
  const index = ranked && line !== undefined ? ranked.indexOf(line) : -1
  if (!ranked || index < 0 || !m) {
    return Math.min(
      Math.max(along(c, side, slot.est), interval(g, cell, slot.door)[0]),
      interval(g, cell, slot.door)[1],
    )
  }
  const sorted = ranked.map((l) => m.get(l) ?? 0).sort((x, y) => x - y)
  let v = sorted[0] ?? 0
  for (let r = 1; r <= index; r++)
    v = Math.max(sorted[r] ?? 0, v + g.apart(ranked[r - 1], ranked[r]))
  return at(v)
}
