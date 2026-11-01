// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type Dir, type GlobalRoute, type GlobalRoutes, horizontal } from './global.js'
import { type Piece, piecesOf } from './lanes.js'
import type { Box } from './metrics.js'
import { type PortEntity, portEntities, portRoom } from './ports.js'
import { type FrameId, frameKey, type Geometry, type Line, type Problem } from './problem.js'
import type { Space, Wall } from './space.js'

const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/**
 * Where across its heading something may lie, and which items bound it at each end: the room a run
 * has. What lies in a room that is not wide enough is a want of room between the two items that
 * make it, which the layout can be asked for; an end with no item is bounded by a frame or the
 * edge of the drawing, which is not for the lines to ask to move.
 */
export interface Room {
  lo: number
  hi: number
  /** The item that bounds each end, and where its edge is. */
  loBy?: Wall[]
  hiBy?: Wall[]
}

export const anywhere: Room = {
  lo: Number.NEGATIVE_INFINITY,
  hi: Number.POSITIVE_INFINITY,
}

/** What two rooms leave: the later start and the earlier end, and the boxes that make them (both rooms' where the two ends are the same place). */
export function meet(a: Room, b: Room): Room {
  const same = (x: number, y: number) => Math.abs(x - y) <= 1e-6
  const lo = b.lo > a.lo + 1e-6 ? b : a
  const hi = b.hi < a.hi - 1e-6 ? b : a
  const loBy = same(a.lo, b.lo) ? union(a.loBy, b.loBy) : lo.loBy
  const hiBy = same(a.hi, b.hi) ? union(a.hiBy, b.hiBy) : hi.hiBy
  return {
    lo: lo.lo,
    hi: hi.hi,
    ...(loBy !== undefined && { loBy }),
    ...(hiBy !== undefined && { hiBy }),
  }
}

function union(a: Wall[] | undefined, b: Wall[] | undefined): Wall[] | undefined {
  if (!a || !b) return a ?? b
  return [
    ...a,
    ...b.filter((w) => !a.some((v) => v.item === w.item && Math.abs(v.edge - w.edge) <= 1e-6)),
  ]
}

/**
 * The free way across `at` between the boxes a stretch from `start` to `end` passes: for a stretch
 * that runs flat (across x), the room in y between the cards above and below it, each kept a margin
 * off, and within the frames it is in, a white inside their edges; a line is kept off by the white
 * counted from its edge, so by half its width more; and the boxes that make each
 * end, for a request for room. A cut the cells are made at is not a wall: the boxes are, wherever
 * along the stretch they stand.
 */
export function between(
  space: Space,
  /** The white between a line's edge and a frame, which the stretch's own width is added to. */
  white: number,
  /** Half the width of the line the stretch is of. */
  half: number,
  flat: boolean,
  start0: number,
  end0: number,
  at: number,
  /** The frames the stretch is in (see `within`). */
  inside: ReadonlySet<FrameId>,
): Room {
  const [start, end] = [Math.min(start0, end0), Math.max(start0, end0)]
  let room: Room = anywhere
  for (const [k, o] of space.obstacles.entries()) {
    const keep = space.margins[k]
    if (!keep) continue
    const [o0, o1] = flat ? [o.x, o.x + o.width] : [o.y, o.y + o.height]
    if (o0 >= end - 1e-3 || o1 <= start + 1e-3) continue
    const [c0, c1] = flat ? [o.y, o.y + o.height] : [o.x, o.x + o.width]
    const item = space.owners[k]
    if (c1 <= at + 1e-3) {
      room = meet(room, {
        lo: c1 + (flat ? keep.bottom : keep.right) + half,
        hi: Number.POSITIVE_INFINITY,
        ...(item && { loBy: [{ item, edge: c1 - white, at: 'high' }] }),
      })
    } else if (c0 >= at - 1e-3) {
      room = meet(room, {
        lo: Number.NEGATIVE_INFINITY,
        hi: c0 - (flat ? keep.top : keep.left) - half,
        ...(item && { hiBy: [{ item, edge: c0 + white, at: 'low' }] }),
      })
    }
  }
  for (const f of space.frames) {
    const b = f.box
    const [o0, o1] = flat ? [b.x, b.x + b.width] : [b.y, b.y + b.height]
    if (o0 >= end - 1e-3 || o1 <= start + 1e-3) continue
    const [c0, c1] = flat ? [b.y, b.y + b.height] : [b.x, b.x + b.width]
    const item = frameKey(f.id)
    // A frame the stretch is in holds it a white inside both its edges; one beside it is kept a
    // white off, as a card is.
    if (inside.has(f.id)) {
      room = meet(room, {
        lo: c0 + white + half,
        hi: c1 - white - half,
        loBy: [{ item, edge: c0, at: 'low' }],
        hiBy: [{ item, edge: c1, at: 'high' }],
      })
    } else if (c1 <= at + 1e-3) {
      room = meet(room, {
        lo: c1 + white + half,
        hi: Number.POSITIVE_INFINITY,
        loBy: [{ item, edge: c1, at: 'high' }],
      })
    } else if (c0 >= at - 1e-3) {
      room = meet(room, {
        lo: Number.NEGATIVE_INFINITY,
        hi: c0 - white - half,
        hiBy: [{ item, edge: c0, at: 'low' }],
      })
    }
  }
  return room
}

/** The frames a cell in `frame` is within: it and every frame round it. */
export function within(problem: Problem): (frame: FrameId) => Set<FrameId> {
  const parent = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const memo = new Map<FrameId, Set<FrameId>>()
  return (frame) => {
    const known = memo.get(frame)
    if (known) return known
    const out = new Set<FrameId>()
    for (let f: FrameId | undefined = frame; f !== undefined; f = parent.get(f)) out.add(f)
    memo.set(frame, out)
    return out
  }
}

/** The rooms of one route: each run's, and each joint's short run across. */
export interface RouteRooms {
  runs: Room[]
  across: (Room | undefined)[]
}

/**
 * The room each run of each route has to lie in, and each joint's run across: where the doors it
 * goes through let it cross, kept a margin from the boxes beside it; for a run through no door, the
 * free way between the boxes it passes; the stretch of its box's side for the first and last run,
 * which stand on the ports; and a lead-out from the box for the turn that follows a port. The
 * layers that put the lines in order and on coordinates read the same rooms, so that what the
 * one asks the other can keep.
 */
export function roomsOf(
  problem: Problem,
  geometry: Geometry,
  space: Space,
  routes: GlobalRoutes,
  ports: readonly PortEntity[] = portEntities(problem, geometry, routes),
  /** The rooms made before for the same space and ports, by the route each was made from: a route laid again is the only one whose rooms change. */
  before?: ReadonlyMap<GlobalRoute, RouteRooms>,
): Map<string, RouteRooms> {
  const { leadOut } = problem.metrics
  const white = problem.metrics.gapApart
  const halfOf = (line: Line) => problem.metrics.width(line.link) / 2
  const { doors } = space
  const labels = new Map<string, (string | undefined)[]>()
  for (const p of ports) labels.set(p.box, [...(labels.get(p.box) ?? []), p.label])
  const entityOf = new Map<string, PortEntity>()
  for (const p of ports) for (const e of p.ends) entityOf.set(`${e.line}.${e.end}`, p)
  const owner = (key: string) =>
    problem.items.find((i) => i.id === key || (i.members ?? []).some((m) => m.node.id === key))?.id
  const owned = (key: string) => {
    const item = owner(key)
    const box = item === undefined ? undefined : geometry.boxes.get(item)
    return item !== undefined && box ? { item, box } : undefined
  }

  const framesOf = within(problem)
  const insideOf = (run: GlobalRoute['runs'][number]): Set<FrameId> => {
    const out = new Set<FrameId>()
    for (const c of run.cells) {
      const cell = space.cells[c]
      if (cell) for (const f of framesOf(cell.frame)) out.add(f)
    }
    return out
  }

  const out = new Map<string, RouteRooms>()
  for (const line of problem.lines) {
    const route = routes.routes.get(line.id)
    const a = entityOf.get(`${line.id}.a`)
    const b = entityOf.get(`${line.id}.b`)
    if (!route || !a || !b) continue
    out.set(line.id, before?.get(route) ?? roomsOfRoute(route, a, b, halfOf(line)))
  }
  return out

  function roomsOfRoute(
    route: GlobalRoute,
    from: PortEntity,
    to: PortEntity,
    half: number,
  ): RouteRooms {
    const { runs } = route
    const last = runs.length - 1
    const slotOf = (p: PortEntity) => problem.metrics.portSlot(labels.get(p.box) ?? [])
    const rooms: Room[] = []
    for (const [i, run] of runs.entries()) {
      const flat = horizontal(run.head)
      // Within the drawing; the boxes the run passes along its whole stretch bound it, each kept a
      // margin off, and are what a request for room is made of. An end of a door is a wall where a
      // card or a frame makes it; where a cut made for a box elsewhere does, the free way goes on
      // past the door, and the run may lie there as well as in it.
      let room: Room = flat
        ? { lo: space.bounds.y, hi: space.bounds.y + space.bounds.height }
        : { lo: space.bounds.x, hi: space.bounds.x + space.bounds.width }
      for (const h of run.hops) {
        const d = doors[route.steps[h]?.door ?? -1]
        if (!d) continue
        room = meet(room, {
          lo: d.by[0] ? d.reach[0] : Number.NEGATIVE_INFINITY,
          hi: d.by[1] ? d.reach[1] : Number.POSITIVE_INFINITY,
          ...(d.by[0] && { loBy: d.by[0] }),
          ...(d.by[1] && { hiBy: d.by[1] }),
        })
      }
      room = meet(room, between(space, white, half, flat, run.from, run.to, run.at, insideOf(run)))
      if (i === 0) room = meet(room, portRoom(from.rect, from.side, slotOf(from), owned(from.box)))
      if (i === last) room = meet(room, portRoom(to.rect, to.side, slotOf(to), owned(to.box)))
      rooms.push(room)
    }

    const across: (Room | undefined)[] = []
    for (const [i, run] of runs.entries()) {
      if (i === 0 || run.kind !== 'joint') {
        across.push(undefined)
        continue
      }
      // The boxes along its stretch bound it (below, with every piece); what is known here is the
      // way back and the lead-out from a port.
      const cx = horizontal((runs[i - 1] as GlobalRoute['runs'][number]).head) ? 'x' : 'y'
      let room: Room = anywhere
      // A line turned back keeps a white inside the cell it came into. Where it came in is a
      // door, except for a line turned back at once after its port, which came in a lead-out from
      // its box: the box is then what bounds it, and what room is asked of.
      if (run.back) {
        const came = cx === 'x' ? run.back.x : run.back.y
        const before = runs[i - 1]
        const sign = before ? ((cx === 'x' ? DX : DY)[before.head] ?? 0) : 0
        const port = i === 1 ? from : i === last ? to : undefined
        const item = port ? owner(port.box) : undefined
        if (sign > 0) {
          room = meet(room, {
            lo: came + white + half,
            hi: Number.POSITIVE_INFINITY,
            ...(item !== undefined && { loBy: [{ item, edge: came - leadOut, at: 'high' }] }),
          })
        } else if (sign < 0) {
          room = meet(room, {
            lo: Number.NEGATIVE_INFINITY,
            hi: came - white - half,
            ...(item !== undefined && { hiBy: [{ item, edge: came + leadOut, at: 'low' }] }),
          })
        }
      }
      across.push(room)
    }

    // The first turn after a port, and the last before one, are a lead-out from the box.
    const clear = (rect: Box | undefined, key: string, out: Dir): Room | undefined => {
      if (!rect) return undefined
      const item = owner(key)
      const edge =
        out === 1
          ? rect.y + rect.height
          : out === 3
            ? rect.y
            : out === 0
              ? rect.x + rect.width
              : rect.x
      if (out === 1 || out === 0) {
        return {
          lo: edge + leadOut + half,
          hi: Number.POSITIVE_INFINITY,
          ...(item !== undefined && { loBy: [{ item, edge, at: 'high' }] }),
        }
      }
      return {
        lo: Number.NEGATIVE_INFINITY,
        hi: edge - leadOut - half,
        ...(item !== undefined && { hiBy: [{ item, edge, at: 'low' }] }),
      }
    }
    const second = runs[1]
    if (second) {
      const limit = clear(from.rect, from.box, route.from.out)
      if (limit) {
        if (second.kind === 'joint') {
          const r = across[1]
          if (r) across[1] = meet(r, limit)
        } else rooms[1] = meet(rooms[1] ?? anywhere, limit)
      }
    }
    const tail = runs[last]
    if (last >= 1 && tail) {
      const limit = clear(to.rect, to.box, route.to.out)
      if (limit) {
        if (tail.kind === 'joint') {
          const r = across[last]
          if (r) across[last] = meet(r, limit)
        } else rooms[last - 1] = meet(rooms[last - 1] ?? anywhere, limit)
      }
    }

    // Then each piece is bounded by the boxes along the stretch it can have: the extent of the
    // pieces either side of it along the other axis, as far as their rooms reach, or the edge of
    // its box at an end of the line; within the cell a joint is made in, and the drawing. The
    // estimate of where a run reaches (above) is where the route put it, which the pieces beside
    // it leave as they are placed; their rooms are everywhere they can be. The joints' runs across
    // first, from the runs they join, and the runs then from the pieces beside them.
    const pieces = piecesOf(route)
    const edgeAt = (p: PortEntity) =>
      p.side === 'top'
        ? p.rect.y
        : p.side === 'bottom'
          ? p.rect.y + p.rect.height
          : p.side === 'left'
            ? p.rect.x
            : p.rect.x + p.rect.width
    const roomOf = (p: Piece | undefined) =>
      p === undefined ? undefined : p.kind === 'run' ? rooms[p.i] : across[p.i]
    const alongBoxes = (p: Piece, k: number): Room | undefined => {
      const room = roomOf(p)
      const run = runs[p.i]
      if (!room || !run) return undefined
      const flat = p.axis === 'y'
      const span = (b: { x0: number; y0: number; x1: number; y1: number }): [number, number] =>
        flat ? [b.x0, b.x1] : [b.y0, b.y1]
      const ends = [pieces[k - 1], pieces[k + 1]].map((q, which): [number, number] => {
        if (q === undefined) {
          const e = edgeAt(which === 0 ? from : to)
          return [e, e]
        }
        const r = roomOf(q)
        return r ? [r.lo, r.hi] : [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY]
      })
      const bounds = span({
        x0: space.bounds.x,
        y0: space.bounds.y,
        x1: space.bounds.x + space.bounds.width,
        y1: space.bounds.y + space.bounds.height,
      })
      const cell = p.kind === 'across' && run.cell ? span(run.cell) : bounds
      const start = Math.max(Math.min(...ends.map((e) => e[0])), cell[0], bounds[0])
      const end = Math.min(Math.max(...ends.map((e) => e[1])), cell[1], bounds[1])
      const inside = new Set<FrameId>()
      if (p.kind === 'across') {
        if (run.cell) for (const f of framesOf(run.cell.frame)) inside.add(f)
      } else {
        for (const f of insideOf(run)) inside.add(f)
      }
      const at = p.kind === 'across' ? (run.mid ?? 0) : run.at
      return meet(room, between(space, white, half, flat, start, end, at, inside))
    }
    for (const [k, p] of pieces.entries()) {
      if (p.kind !== 'across') continue
      const bounded = alongBoxes(p, k)
      if (bounded) across[p.i] = bounded
    }
    const bounded = pieces.map((p, k) => (p.kind === 'run' ? alongBoxes(p, k) : undefined))
    for (const [k, p] of pieces.entries()) {
      const b = bounded[k]
      if (p.kind === 'run' && b) rooms[p.i] = b
    }
    return { runs: rooms, across }
  }
}
