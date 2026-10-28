// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Structure } from '../structure/types.js'
import { chooseStacks, type StackOrder } from './aspect.js'
import { assemble } from './assemble.js'
import { demandsOf } from './demands.js'
import { buildGrid } from './grid.js'
import { solveHorizontal } from './horizontal.js'
import type { Metrics } from './metrics.js'
import { orderSiblings } from './order.js'
import { assignPorts, widen } from './ports.js'
import { type Demand, type Order, readProblem, type Wiring } from './problem.js'
import { routeLines } from './route.js'
import type { Scene, Side } from './scene.js'
import { nudge } from './tracks.js'
import { solveVertical } from './vertical.js'

const EPS = 1e-6

export interface LayoutOptions {
  /**
   * What decides how far siblings that the flows put in order are stacked, after crossings:
   * the shape of the drawing first (`aspect-first`, the default) or the room it wastes first
   * (`fill-first`).
   */
  stackOrder?: StackOrder
}

/**
 * Lays a network out as a scene: where each box stands and how each line runs. `network` is
 * the configuration as written, `structure` what follows from it and the boundary points, and
 * `metrics` every length the drawing may use.
 *
 * Placement comes first and wiring second, and the wiring then tells the placement what it
 * needs: a card wide enough for its ports, a corridor wide enough for the lines that run along
 * it. Those requests only add room, so the placement and the wiring are repeated until a
 * round asks for nothing new, at most once for each box.
 */
export function layoutDrawing(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  options: LayoutOptions = {},
): Scene {
  let problem = chooseStacks(
    readProblem(network, structure, metrics),
    options.stackOrder ?? 'aspect-first',
  )
  const demands = new Map<string, Demand>()
  let order: Order | undefined
  // Crossings are only worth lowering once the room is settled; until then routes are for the
  // corridors they show.
  let settled = false
  let last:
    | {
        problem: typeof problem
        order: Order
        geometry: ReturnType<typeof solveHorizontal>
        wiring: Wiring
      }
    | undefined

  for (let round = 0; round <= problem.items.length; round++) {
    const asked = [...demands.values()]
    const y = solveVertical(problem, asked)
    order = order ?? orderSiblings(problem, y)
    const geometry = solveHorizontal(problem, y, order, asked)

    const { plans, widths } = assignPorts(problem, geometry)
    const grown = [...widths].some(([key, w]) => {
      const item = problem.items.find((i) => i.id === key)
      const member = problem.items.flatMap((i) => i.members ?? []).find((m) => m.node.id === key)
      return w > (item?.size.width ?? member?.size.width ?? Number.POSITIVE_INFINITY) + EPS
    })
    if (grown) {
      problem = widen(problem, widths)
      continue
    }

    const grid = buildGrid(problem, geometry, plans)
    const routes = routeLines(problem, geometry, plans, grid, settled)
    const sides = new Map<string, [Side, Side]>()
    for (const p of plans) {
      const other = plans.find((q) => q.line === p.line && q.end !== p.end)
      if (p.end === 'a' && other) sides.set(p.line.id, [p.side, other.side])
    }
    const core = new Set(
      problem.lines.filter((l) => l.role === 'oriented' || l.role === 'attach').map((l) => l.id),
    )
    const tracks = nudge(routes.wires, sides, metrics.pitch, core)
    last = {
      problem,
      order,
      geometry,
      wiring: {
        wires: tracks.wires,
        ports: routes.ports,
        demands: asked,
        violations: routes.unroutable.map((lineId) => ({ lineId, through: 'unroutable' })),
      },
    }
    let more = false
    for (const d of demandsOf(problem, geometry, tracks.bundles)) {
      const key = `${d.axis}\0${d.before}\0${d.after}`
      const known = demands.get(key)
      if (!known || d.min > known.min + EPS) {
        demands.set(key, d)
        more = true
      }
    }
    if (more) continue
    if (settled) break
    settled = true
  }

  if (!last) throw new Error('the drawing could not be laid out')
  return assemble(last.problem, last.geometry, last.wiring, last.order)
}
