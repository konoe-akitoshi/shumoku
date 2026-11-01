// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Ordering } from './bundle-order.js'
import type { GlobalRoutes } from './global.js'
import type { Geometry, Problem } from './problem.js'
import { constraintsOf } from './realize-constraints.js'
import { type Realized, wiresOf } from './realize-wires.js'
import type { RouteRooms } from './rooms.js'
import { solveXY } from './solve-xy.js'
import type { Space } from './space.js'

export type { Realized } from './realize-wires.js'

/**
 * Puts every line on coordinates. The routes say which doors a line goes through, and the orders
 * say how the lines at one door stand; here each straight run of a line is an unknown (its x if it
 * goes up or down, its y if across), as is each port along the edge of its box and each short run
 * across that moves a line sideways. Each axis is solved by itself.
 *
 * It is three steps, each in a file of its own: what is asked of the unknowns
 * (`constraintsOf`), x and then y solved from it (`solveXY`), and the lines drawn from the values
 * (`wiresOf`).
 */
export function realize(
  problem: Problem,
  geometry: Geometry,
  space: Space,
  routes: GlobalRoutes,
  ordering: Ordering,
  rooms: ReadonlyMap<string, RouteRooms>,
): Realized {
  const constraints = constraintsOf(problem, geometry, space, routes, ordering, rooms)
  return wiresOf(problem, geometry, constraints, solveXY(constraints))
}
