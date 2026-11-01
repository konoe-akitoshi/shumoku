// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readNetworkModel } from '../models/network-model-graph.js'
import { deriveStructure } from '../structure/index.js'
import { assemble } from './assemble.js'
import { orderBundles } from './bundle-order.js'
import { createRouter } from './global.js'
import { familyOf, pitchMax } from './kin.js'
import type { Parts } from './layout.js'
import type { Metrics } from './metrics.js'
import { portEntities, portSlots } from './ports.js'
import { type Geometry, type Order, type Problem, readProblem } from './problem.js'
import { realize } from './realize.js'
import { roomsOf } from './rooms.js'
import type { Scene } from './scene.js'
import { buildSpace } from './space.js'

/** Round lengths for tests, so expected positions can be written down. */
export const testMetrics: Metrics = {
  card: () => ({ width: 100, height: 40 }),
  bus: (_id, lines) => ({ width: 20 * Math.max(lines, 1), height: 10 }),
  cloud: () => ({ width: 100, height: 40 }),
  group: () => ({ top: 20, right: 10, bottom: 10, left: 10 }),
  gap: 30,
  memberGap: 10,
  groupGap: 40,
  hullPad: 5,
  width: () => 0,
  gapTwin: 4,
  gapApart: 4,
  aspect: 16 / 9,
  leadOut: 10,
  portSlot: () => 20,
}

export function networkOf(yaml: string, boundary: string[]) {
  const network = readNetworkModel(yaml).config
  return { network, structure: deriveStructure(network, { boundary }) }
}

export function problemOf(yaml: string, boundary: string[]): Problem {
  const { network, structure } = networkOf(yaml, boundary)
  return readProblem(network, structure, testMetrics)
}

/**
 * The wiring of `parts.problem` laid once over a placement that is not its own (a geometry and
 * the order of the members from another layout), with no round asking the placement for room:
 * what the wiring alone makes of that placement.
 */
export function rewire(parts: Pick<Parts, 'problem'>, geometry: Geometry, order: Order): Scene {
  const { problem } = parts
  const space = buildSpace(problem, geometry)
  const routes = createRouter(problem, geometry, space).result
  const rooms = roomsOf(problem, geometry, space, routes, portEntities(problem, geometry, routes))
  const ordering = orderBundles(
    space,
    routes,
    pitchMax(problem.metrics, problem.lines),
    true,
    rooms,
    portSlots(problem),
    familyOf(problem.lines),
  )
  const realized = realize(problem, geometry, space, routes, ordering, rooms)
  const wiring = { wires: realized.wires, ports: realized.ports, demands: [], violations: [] }
  return assemble(problem, geometry, wiring, order)
}
