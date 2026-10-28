// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { assemble } from './assemble.js'
import { solveHorizontal } from './horizontal.js'
import type { Metrics } from './metrics.js'
import { orderSiblings } from './order.js'
import { readProblem } from './problem.js'
import type { Scene } from './scene.js'
import { simpleWires } from './simple-wires.js'
import { solveVertical } from './vertical.js'

/**
 * Lays a network out as a scene: where each box stands and how each line runs. `network` is
 * the configuration as written, `structure` what follows from it and the boundary points, and
 * `metrics` every length the drawing may use.
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Scene {
  const problem = readProblem(network, structure, metrics)
  const y = solveVertical(problem)
  const order = orderSiblings(problem, y)
  const geometry = solveHorizontal(problem, y, order)
  const wiring = simpleWires(problem, geometry)
  return assemble(problem, geometry, wiring, order)
}
