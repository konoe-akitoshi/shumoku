// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type Dir, type GlobalRoute, type GlobalRoutes, horizontal } from './global.js'
import type { Box } from './metrics.js'
import { type PortEntity, portEntities, portRoom } from './ports.js'
import type { Geometry, Problem } from './problem.js'
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
): Map<string, RouteRooms> {
  const { pitch, leadOut } = problem.metrics
  const { doors } = space
  const labels = new Map<string, (string | undefined)[]>()
  for (const p of ports) labels.set(p.box, [...(labels.get(p.box) ?? []), p.label])
  const entityOf = new Map<string, PortEntity>()
  for (const p of ports) for (const e of p.ends) entityOf.set(`${e.line}.${e.end}`, p)
  const owner = (key: string) =>
    problem.items.find((i) => i.id === key || (i.members ?? []).some((m) => m.node.id === key))?.id

  const out = new Map<string, RouteRooms>()
  for (const line of problem.lines) {
    const route = routes.routes.get(line.id)
    const a = entityOf.get(`${line.id}.a`)
    const b = entityOf.get(`${line.id}.b`)
    if (!route || !a || !b) continue
    out.set(line.id, roomsOfRoute(route, a, b))
  }
  return out

  function roomsOfRoute(route: GlobalRoute, from: PortEntity, to: PortEntity): RouteRooms {
    const { runs } = route
    const last = runs.length - 1
    const slotOf = (p: PortEntity) => problem.metrics.portSlot(labels.get(p.box) ?? [])
    const rooms: Room[] = []
    for (const [i, run] of runs.entries()) {
      let room: Room = anywhere
      for (const h of run.hops) {
        const d = doors[route.steps[h]?.door ?? -1]
        if (!d) continue
        room = meet(room, {
          lo: d.reach[0],
          hi: d.reach[1],
          ...(d.by[0] && { loBy: d.by[0] }),
          ...(d.by[1] && { hiBy: d.by[1] }),
        })
      }
      if (run.hops.length === 0) {
        // No door says where it may lie: the free way between the cards that it passes, which is
        // more than the one cell it turns in, since the cells are cut at the edge of every box.
        const flat = horizontal(run.head)
        const [start, end] = [Math.min(run.from, run.to), Math.max(run.from, run.to)]
        for (const [k, o] of space.obstacles.entries()) {
          const keep = space.margins[k]
          if (!keep) continue
          const [o0, o1] = flat ? [o.x, o.x + o.width] : [o.y, o.y + o.height]
          if (o0 >= end - 1e-3 || o1 <= start + 1e-3) continue
          const [c0, c1] = flat ? [o.y, o.y + o.height] : [o.x, o.x + o.width]
          const item = space.owners[k]
          if (c1 <= run.at + 1e-3) {
            room = meet(room, {
              lo: c1 + (flat ? keep.bottom : keep.right),
              hi: Number.POSITIVE_INFINITY,
              ...(item && { loBy: [{ item, edge: c1 - pitch }] }),
            })
          } else if (c0 >= run.at - 1e-3) {
            room = meet(room, {
              lo: Number.NEGATIVE_INFINITY,
              hi: c0 - (flat ? keep.top : keep.left),
              ...(item && { hiBy: [{ item, edge: c0 + pitch }] }),
            })
          }
        }
      }
      if (i === 0) room = meet(room, portRoom(from.rect, from.side, slotOf(from)))
      if (i === last) room = meet(room, portRoom(to.rect, to.side, slotOf(to)))
      rooms.push(room)
    }

    const across: (Room | undefined)[] = []
    for (const [i, run] of runs.entries()) {
      if (i === 0 || run.kind !== 'joint') {
        across.push(undefined)
        continue
      }
      const cell = run.cell
      const cx = horizontal((runs[i - 1] as GlobalRoute['runs'][number]).head) ? 'x' : 'y'
      const walls = cell ? space.wallsOf(cell, cx) : undefined
      let room: Room = cell
        ? {
            ...(cx === 'x' ? { lo: cell.x0, hi: cell.x1 } : { lo: cell.y0, hi: cell.y1 }),
            ...(walls && walls.lo.length > 0 && { loBy: walls.lo }),
            ...(walls && walls.hi.length > 0 && { hiBy: walls.hi }),
          }
        : anywhere
      // A line turned back keeps a pitch inside the cell it came into.
      if (run.back) {
        const came = cx === 'x' ? run.back.x : run.back.y
        const before = runs[i - 1]
        const sign = before ? ((cx === 'x' ? DX : DY)[before.head] ?? 0) : 0
        if (sign > 0) room = meet(room, { lo: came + pitch, hi: Infinity })
        else if (sign < 0) room = meet(room, { lo: -Infinity, hi: came - pitch })
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
          lo: edge + leadOut,
          hi: Number.POSITIVE_INFINITY,
          ...(item !== undefined && { loBy: [{ item, edge }] }),
        }
      }
      return {
        lo: Number.NEGATIVE_INFINITY,
        hi: edge - leadOut,
        ...(item !== undefined && { hiBy: [{ item, edge }] }),
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
    return { runs: rooms, across }
  }
}
