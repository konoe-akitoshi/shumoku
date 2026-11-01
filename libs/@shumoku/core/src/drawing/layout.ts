// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { joinKey, splitKey } from '../structure/keys.js'
import type { Structure } from '../structure/types.js'
import { assemble } from './assemble.js'
import { type Ordering, orderBundles } from './bundle-order.js'
import { demandsOf } from './demands.js'
import { createRouter, type GlobalRoute } from './global.js'
import { solveHorizontal } from './horizontal.js'
import { spacingOf } from './kin.js'
import type { Metrics } from './metrics.js'
import { orderSiblings } from './order.js'
import { portEntities, portHeights, portWidths, widen } from './ports.js'
import {
  type Demand,
  type Geometry,
  type Order,
  type Problem,
  parseLineEnd,
  readProblem,
  type Wiring,
} from './problem.js'
import { realize } from './realize.js'
import { grownBy, RingError } from './ring.js'
import { type RouteRooms, roomsOf } from './rooms.js'
import type { Scene } from './scene.js'
import { buildSpace } from './space.js'
import { EPS } from './tolerance.js'
import { solveVertical } from './vertical.js'

/**
 * Lays a network out as a scene: where each box stands and how each line runs. `network` is
 * the configuration as written, `structure` what follows from it and the boundary points, and
 * `metrics` every length the drawing may use.
 *
 * Siblings that the flows put in order are always stacked: a frame's place up or down says
 * upstream or downstream, so it is not moved for the shape of the drawing.
 *
 * Placement comes first and wiring second, and the wiring then tells the placement what it
 * needs: a card wide enough for its ports, a corridor wide enough for the lines that run along
 * it. Those requests only add room, so the placement and the wiring are repeated until a
 * round asks for nothing new, at most once for each box. The wiring is: the free space cut into
 * cells (`buildSpace`), each line's way through the doors of the cells (`routeGlobal`), the order
 * of the lines at every door (`orderBundles`), and their coordinates (`realize`).
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Scene {
  return layoutParts(network, structure, metrics).scene
}

/** What `layoutDrawing` settled on, for the layers that are run beside the wiring to compare. */
export interface Parts {
  scene: Scene
  problem: Problem
  order: Order
  geometry: Geometry
  wiring: Wiring
  /** How the lines stand at the doors, and the crossings that count to. */
  ordering: Ordering
  /** Lines whose ends the structure does not relate, which place nothing. */
  unrelated: string[]
  /** What the wiring could not meet, and the corridors drawn narrower than the lines in them need (a check, `demandsOf`). */
  unmet: ReturnType<typeof realize>['unmet'] & { corridors: number }
  /** Where the room fell short. */
  squeezedAt: ReturnType<typeof realize>['squeezedAt']
  /** How the orders of the lines side by side were decided in the last round. */
  lanes: ReturnType<typeof realize>['lanes']
  /** The pairs settled on a solution in each round, to see whether they hold from one round to the next. */
  laneRounds: string[][]
  /** Rooms asked between box edges that the layout could not keep with the others, and so were given up. */
  refused: number
  /** Each of those: the axis, the two boxes and the edges of each the room was asked between. */
  refusedAt: string[]
  /** How many times the placement and the wiring were laid out, each asking the placement for what the last lacked. */
  rounds: number
  /** The ends laid again with a joint in the last round, because the order of their side left their port no room, and the times the orders were settled for that. */
  loosened: number
  passes: number
  /** The ends laid again, by line and end. */
  loosenedAt: string[]
}

export function layoutParts(network: input.Network, structure: Structure, metrics: Metrics): Parts {
  let problem = readProblem(network, structure, metrics)
  const demands = new Map<string, Demand>()
  let order: Order | undefined
  // The orders at the doors are changed along the bundles only once the room is settled; until then
  // the routes are for the corridors they show, and that change is most of the wiring's time.
  let settled = false
  let last: Omit<Parts, 'scene'> | undefined

  /**
   * The rooms asked of the layout, in the order they were asked. Round a ring of boxes they may
   * add up to more than a box is wide, which that box grown meets; where no box can grow (the
   * ring runs through frames, or what the structure holds level), the latest asked of the boxes
   * on the ring is given up, and not asked again.
   */
  const edges: { key: string; axis: 'x' | 'y'; before: string; after: string }[] = []
  const refused = new Set<string>()
  const keyOf = (d: Demand) =>
    joinKey([d.axis, d.before, d.beforeAt ?? 'high', d.after, d.afterAt ?? 'low'])

  let rounds = 0
  let loosened = new Set<string>()
  const laneRounds: string[][] = []
  for (let round = 0; round <= problem.items.length; round++) {
    rounds++
    // The ends laid again are found afresh each round: a joint made for a box that was narrow in
    // an earlier round would otherwise stay.
    loosened = new Set<string>()
    let asked: Demand[] = []
    let y: ReturnType<typeof solveVertical>
    let geometry: Geometry
    // Where the layout of one axis cannot keep what was asked together, a box the ring runs
    // against is grown by what it lacks; where there is none, the latest room asked along that
    // axis of the boxes on the ring is given up: a request for one axis cannot be what the other
    // cannot keep. Boxes are grown at most as many times in a round as there are boxes, after
    // which rooms are given up: a ring that growing does not break must end.
    let grownFor = 0
    const giveUp = (axis: 'x' | 'y', e: unknown) => {
      const ring = e instanceof RingError ? e : undefined
      if (ring && ring.grow.size > 0 && grownFor++ < problem.items.length) {
        const larger = grownBy(problem.items, ring, axis)
        problem = axis === 'x' ? widen(problem, larger) : widen(problem, new Map(), larger)
        return
      }
      const on = (edge: (typeof edges)[number]) =>
        edge.axis === axis &&
        (!ring || ring.keys.includes(edge.before) || ring.keys.includes(edge.after))
      const last = (fits: (edge: (typeof edges)[number]) => boolean) =>
        edges.reduce((found, edge, k) => (fits(edge) ? k : found), -1)
      let at = last(on)
      if (at < 0) at = last((edge) => edge.axis === axis)
      const edge = edges[at]
      if (!edge) throw e
      edges.splice(at, 1)
      demands.delete(edge.key)
      refused.add(edge.key)
    }
    for (;;) {
      asked = [...demands.values()]
      try {
        y = solveVertical(problem, asked)
      } catch (e) {
        giveUp('y', e)
        continue
      }
      order = order ?? orderSiblings(problem, y)
      try {
        geometry = solveHorizontal(problem, y, order, asked)
        break
      } catch (e) {
        giveUp('x', e)
      }
    }

    const space = buildSpace(problem, geometry)
    const router = createRouter(problem, geometry, space)
    const routes = router.result
    const ports = portEntities(problem, geometry, routes)
    const widths = portWidths(problem, ports)
    const heights = portHeights(problem, ports)
    const sizeOf = (key: string) => {
      const item = problem.items.find((i) => i.id === key)
      const member = problem.items.flatMap((i) => i.members ?? []).find((m) => m.node.id === key)
      return item?.size ?? member?.size
    }
    const grown =
      [...widths].some(([key, w]) => w > (sizeOf(key)?.width ?? Number.POSITIVE_INFINITY) + EPS) ||
      [...heights].some(([key, h]) => h > (sizeOf(key)?.height ?? Number.POSITIVE_INFINITY) + EPS)
    if (grown) {
      problem = widen(problem, widths, heights)
      continue
    }

    // The orders at the doors and the ports are settled on the routes; where the order of the ports
    // of a side then leaves one no room within the window its line leaves it, that line is laid
    // again with a joint at that end, which frees the port of the doors, and the orders are settled
    // again on the new routes. An end laid again stays so, and the ends are finite, so this ends.
    const spacing = spacingOf(problem)
    let made = new Map<GlobalRoute, RouteRooms>()
    const makeRooms = () => {
      const rooms = roomsOf(problem, geometry, space, routes, ports, made)
      made = new Map(
        [...rooms].flatMap(([id, r]) => {
          const route = routes.routes.get(id)
          return route ? [[route, r] as const] : []
        }),
      )
      return rooms
    }
    const toLay = (keys: readonly string[]) => keys.map(parseLineEnd)
    // Once the room is settled, the orders are changed along the bundles, which is most of the
    // time: on the first orders of the round, which the ends laid again are found on, and once more
    // when nothing more is laid again, whose changes are then looked at.
    let rooms = makeRooms()
    let ordering = orderBundles(space, routes, spacing, settled, rooms)
    let climbed = settled
    let passes = 1
    const layAgain = (fresh: readonly string[]): boolean => {
      const laidAgain = router.loosen(toLay(fresh))
      // An end that cannot be laid again (its window was already empty) is marked too, so that
      // it is not asked for twice; the room it lacks is then the placement's to give.
      for (const k of fresh) loosened.add(k)
      if (laidAgain.length === 0) return false
      rooms = makeRooms()
      ordering = orderBundles(space, routes, spacing, false, rooms)
      climbed = false
      passes++
      return true
    }
    let realized: ReturnType<typeof realize>
    for (;;) {
      for (;;) {
        const fresh = ordering.unfit.filter((k) => !loosened.has(k))
        if (fresh.length === 0 || !layAgain(fresh)) break
      }
      realized = realize(problem, geometry, space, routes, ordering, rooms)
      // A chain of orders that the rooms cannot hold, and that no room can be asked for (its ends
      // are one box, or the rooms asked were given up), is parted at a port that still goes
      // straight out through a door: that line is laid again with a joint there.
      const fresh: string[] = []
      for (const q of realized.squeezedAt) {
        const open = q.asks.some((a) => !refused.has(keyOf({ axis: q.axis, ...a })))
        if (open) continue
        const end = q.ends.find((k) => !loosened.has(k) && !fresh.includes(k))
        if (end !== undefined) fresh.push(end)
      }
      if (fresh.length > 0 && layAgain(fresh)) continue
      if (!settled || climbed) break
      ordering = orderBundles(space, routes, spacing, true, rooms)
      climbed = true
      passes++
    }
    last = {
      problem,
      order,
      geometry,
      wiring: {
        wires: realized.wires,
        ports: realized.ports,
        demands: asked,
        violations: routes.unroutable.map((lineId) => ({ lineId, through: 'unroutable' })),
      },
      ordering,
      unrelated: problem.lines.filter((l) => l.role === 'unrelated').map((l) => l.id),
      unmet: { ...realized.unmet, corridors: 0 },
      squeezedAt: realized.squeezedAt,
      lanes: realized.lanes,
      laneRounds,
      refused: refused.size,
      refusedAt: [...refused].map((k) => splitKey(k).join(' ')),
      rounds,
      loosened: loosened.size,
      passes,
      loosenedAt: [...loosened].sort(),
    }
    laneRounds.push(realized.lanes.settled)
    let more = false
    for (const d of realized.demands) {
      const key = keyOf(d)
      if (refused.has(key)) continue
      const known = demands.get(key)
      if (!known || d.min > known.min + EPS) {
        demands.set(key, d)
        if (!known) edges.push({ key, axis: d.axis, before: d.before, after: d.after })
        more = true
      }
    }
    if (more) continue
    if (settled) break
    settled = true
  }

  if (!last) throw new Error('the drawing could not be laid out')
  // The lines as drawn, looked at once more: no corridor is left narrower than the lines in it need.
  const corridors = demandsOf(last.problem, last.geometry, last.wiring.wires).length
  return {
    ...last,
    unmet: { ...last.unmet, corridors },
    scene: assemble(last.problem, last.geometry, last.wiring, last.order),
  }
}
