// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { GlobalRoutes } from './global.js'
import type { Spacing } from './kin.js'
import type { Chords } from './order-chords.js'
import { chordsOf, countCrossings } from './order-chords.js'
import type { Corridors } from './order-classes.js'
import { corridorsOf, type Orders, orderByEstimate, orderClasses } from './order-classes.js'
import { type Climb, climbOf, type Move } from './order-climb.js'
import { type Passing, type Paths, passingOf, pathsOf } from './order-paths.js'
import {
  derivePorts,
  keepPorts,
  noPorts,
  type PortGrid,
  type Ports,
  portGridOf,
  unfitAcross,
} from './order-ports.js'
import type { RouteRooms } from './rooms.js'
import type { Space } from './space.js'

export type { Climb, Move } from './order-climb.js'
export { type Passing, passingName } from './order-paths.js'

export interface Ordering {
  /** The passings of lines at each door (see `passing`), from the low end of the door to the high end. */
  doors: Map<number, Passing[]>
  /** The bundles that were ordered by a search that is not exhaustive (more than eight lines). */
  approximated: number
  /** Where each port stands along the perimeter of its cell, once the ports follow the bundles. */
  ports: Map<string, number>
  /** How many pairs of lines cross inside a cell, counted from the orders. */
  crossings: number
  /** The same with the ports where they were. */
  crossingsBefore: number
  /** The same with every door's lines in the order of where they were estimated to cross it. */
  crossingsByEstimate: number
  /** The crossings in the cells before the orders were changed along the bundles (`climb`). */
  crossingsSettled: number
  /** What changing the orders along the bundles did. */
  climb: Climb
  perCell: Map<number, number>
  /** The lines of each crossing counted in `crossings`, one pair for each, with the cells' order. */
  pairs: [string, string][]
  /** Where each line runs across each cell, as places along the cell's perimeter, once ordered. */
  chords: Map<number, { line: string; p: number; q: number }[]>
  /**
   * The ports (`line.end`) that, in the order their side has, cannot stand a slot from the one
   * before within the window their line leaves them (the stretch the doors leave its first run).
   * The order is not changed for them: their lines are to be laid again so that the port is free
   * of the doors, which is the route layer's to do.
   */
  unfit: string[]
}

export interface OrderSession {
  moves(): Move[]
  /** Makes the change and counts only what it touches. Gives how to undo it, or nothing if it cannot be made. */
  apply(move: Move): (() => void) | undefined
  /** The crossings now, in the cells, as counted by the changes so far. */
  total(): number
  /** The same counted again from the orders alone. */
  recount(): number
  /** Makes the changes that cross less, for as long as there are some. */
  climb(): Climb
  ordering(): Ordering
}

/** What the settling of the orders and the ports for each other gives to the climb. */
interface Settled {
  orders: Orders
  ports: Ports
  /** The bundles of `orders` that were searched for without being exhaustive. */
  approximated: number
  crossingsByEstimate: number
  crossingsBefore: number
  crossingsSettled: number
}

/**
 * The orders at the doors depend on where the ports stand and the ports on the orders, so each
 * is settled for the other in turn, for as long as that crosses less.
 */
function settle(
  g: Paths,
  corridors: Corridors,
  chords: Chords,
  grid: PortGrid,
  family: Spacing['family'],
): Settled {
  const crossingsByEstimate = countCrossings(g, noPorts().pos, orderByEstimate(g), chords).total
  let ports = keepPorts(grid, noPorts())
  let orders = orderClasses(g, corridors, ports.pos, family)
  const before = countCrossings(g, ports.pos, orders.order, chords)
  let after = before
  let { unfit } = ports
  for (let round = 0; round < g.lines.length; round++) {
    const derived = derivePorts(g, grid, orders.order, ports)
    const next = orderClasses(g, corridors, derived.pos, family)
    // what the last round left is reported, kept or not
    unfit = derived.unfit
    const now = countCrossings(g, derived.pos, next.order, chords)
    if (now.total >= after.total) break
    after = now
    ports = derived
    orders = next
  }
  return {
    orders,
    ports: { pos: ports.pos, unfit },
    approximated: orders.approximated,
    crossingsByEstimate,
    crossingsBefore: before.total,
    crossingsSettled: after.total,
  }
}

/**
 * Where each line stands along every door it goes through. The routes only say which doors a line
 * passes; two lines through one door can take either order, and what the order costs is decided
 * where they part: the one that goes on to the left of the other must be on its left. A pair
 * that goes through several doors one after another is one bundle, and keeps its order through
 * them (the order flips or not at each cell by the way the cell's perimeter runs). So for each
 * door the order of its lines is the one, among all, in which the pairs cross least where they
 * part at either end of what they share (`laneOrder`); what that cannot tell apart is settled the
 * same way along a bundle, by id.
 *
 * The ports of the lines that leave one card by one side of one cell are then swapped among the
 * places they stand at, in the order that crosses least.
 *
 * Those are settled door by door and cell by cell, and a bundle runs through several. So the orders
 * are then changed along whole bundles (`climb`): two lines next to each other at a door are
 * swapped at every door of the doors they go through together, and two ports next to each other
 * are swapped, each for as long as the crossings in all the cells are fewer.
 * Nothing about a route changes, so no line is longer.
 *
 * It is four stages, each in a file of its own, each given the ones before: what the routes pass
 * (`pathsOf`), the corridors of doors and the orders in them (`orderClasses`), where the ports
 * stand (`derivePorts`), and the changes along the bundles (`climbOf`).
 */
export function orderSession(
  space: Space,
  routes: GlobalRoutes,
  /**
   * The pitch of each pair of neighbours and the slot of each box's ports. Of two orders that cost
   * the same, the one decided by the lines' names puts a family together first, so twins stand
   * side by side wherever the order is not asked for by the crossings.
   */
  spacing: Spacing,
  rooms?: ReadonlyMap<string, RouteRooms>,
): OrderSession {
  const g = pathsOf(space, routes, spacing, rooms)
  const corridors = corridorsOf(g)
  const chords = chordsOf(g)
  const grid = portGridOf(g, spacing, rooms)
  const settled = settle(g, corridors, chords, grid, spacing.family)
  const { orders, ports } = settled
  const climbing = climbOf(g, corridors, chords, grid, orders, ports)
  return {
    moves: climbing.moves,
    apply: climbing.apply,
    total: climbing.total,
    recount: climbing.recount,
    climb: climbing.climb,
    ordering() {
      const final = countCrossings(g, ports.pos, orders.order, chords)
      return {
        doors: new Map(
          [...orders.order].map(([door, ids]) => [
            door,
            ids.flatMap((id) => {
              const piece = g.pieces.get(id)
              const path = piece && g.lines[piece.path]?.path
              const j = piece?.slots[0]
              return path && j !== undefined ? [passingOf(path, j)] : []
            }),
          ]),
        ),
        approximated: settled.approximated,
        ports: ports.pos,
        crossings: final.total,
        crossingsBefore: settled.crossingsBefore,
        crossingsByEstimate: settled.crossingsByEstimate,
        crossingsSettled: settled.crossingsSettled,
        climb: climbing.climbed(),
        perCell: final.perCell,
        pairs: final.pairs,
        chords: final.chords,
        unfit: [
          ...new Set([
            ...ports.unfit,
            ...(ports.unfit.size === 0 ? unfitAcross(g, grid, ports.pos) : []),
          ]),
        ].sort(compare),
      }
    },
  }
}

/**
 * Where each line stands along every door it goes through (see `orderSession`), settled in the
 * ways that make no line longer.
 */
export function orderBundles(
  space: Space,
  routes: GlobalRoutes,
  spacing: Spacing,
  /** Whether to change the orders along the bundles, which is most of the time spent. */
  climb = true,
  rooms?: ReadonlyMap<string, RouteRooms>,
): Ordering {
  const session = orderSession(space, routes, spacing, rooms)
  if (climb) session.climb()
  return session.ordering()
}
