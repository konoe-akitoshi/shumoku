// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { assemble } from './assemble.js'
import { type Ordering, orderBundles } from './bundle-order.js'
import { routeGlobal } from './global.js'
import { solveHorizontal } from './horizontal.js'
import type { Metrics } from './metrics.js'
import { orderSiblings } from './order.js'
import { portEntities, portHeights, portSlots, portWidths, widen } from './ports.js'
import {
  type Demand,
  type Geometry,
  type Order,
  type Problem,
  readProblem,
  type Wiring,
} from './problem.js'
import { realize } from './realize.js'
import { roomsOf } from './rooms.js'
import type { Scene } from './scene.js'
import { buildSpace } from './space.js'
import { solveVertical } from './vertical.js'

const EPS = 1e-6

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
  /** What the wiring could not meet. */
  unmet: ReturnType<typeof realize>['unmet']
  /** Where the room fell short. */
  squeezedAt: ReturnType<typeof realize>['squeezedAt']
  /** Rooms asked between box edges that the layout could not keep with the others, and so were given up. */
  refused: number
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
   * Rooms asked between the edges of the boxes that bound a stretch for ports, in the order they
   * were asked. They may be asked of a pair in both directions, or round a ring of boxes, which
   * the layout cannot keep together; the latest is then given up, and not asked again.
   */
  const edges: string[] = []
  const refused = new Set<string>()

  for (let round = 0; round <= problem.items.length; round++) {
    let asked: Demand[] = []
    let y: ReturnType<typeof solveVertical>
    let geometry: Geometry
    for (;;) {
      asked = [...demands.values()]
      try {
        y = solveVertical(problem, asked)
        order = order ?? orderSiblings(problem, y)
        geometry = solveHorizontal(problem, y, order, asked)
        break
      } catch (e) {
        const give = edges.pop()
        if (give === undefined) throw e
        demands.delete(give)
        refused.add(give)
      }
    }

    const space = buildSpace(problem, geometry)
    const routes = routeGlobal(problem, geometry, space)
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

    const rooms = roomsOf(problem, geometry, space, routes, ports)
    const ordering = orderBundles(space, routes, metrics.pitch, settled, rooms, portSlots(problem))
    const realized = realize(problem, geometry, space, routes, ordering, rooms)
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
      unmet: realized.unmet,
      squeezedAt: realized.squeezedAt,
      refused: refused.size,
    }
    let more = false
    for (const d of realized.demands) {
      const key = `${d.axis}\u0000${d.before}\u0000${d.beforeAt ?? 'high'}\u0000${d.after}\u0000${d.afterAt ?? 'low'}`
      if (refused.has(key)) continue
      const own = d.beforeAt !== undefined || d.afterAt !== undefined
      // Boxes each asked to reach past the other cannot both be: their reaches add up to what the two
      // widths are, so the second to be asked is given up.
      if (
        own &&
        [...demands.values()].some(
          (o) =>
            o.axis === d.axis &&
            o.before === d.after &&
            o.after === d.before &&
            (o.beforeAt !== undefined || o.afterAt !== undefined),
        )
      ) {
        refused.add(key)
        continue
      }
      const known = demands.get(key)
      if (!known || d.min > known.min + EPS) {
        demands.set(key, d)
        if (!known && (d.beforeAt !== undefined || d.afterAt !== undefined)) edges.push(key)
        more = true
      }
    }
    if (more) continue
    if (settled) break
    settled = true
  }

  if (!last) throw new Error('the drawing could not be laid out')
  return { ...last, scene: assemble(last.problem, last.geometry, last.wiring, last.order) }
}
