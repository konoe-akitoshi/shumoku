// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Corridors } from './corridors.js'
import { auditCrossings } from './geometry/audit.js'
import { type Plan, planOf } from './geometry/plan.js'
import { type Axis, axisOf, shortOf } from './geometry/system.js'
import { placeX } from './geometry/x.js'
import { placeY } from './geometry/y.js'
import { frameKey } from './keys.js'
import { lanesOf } from './lane-order.js'
import type { Layers } from './layers.js'
import type { Box, Point } from './metrics.js'
import { type Geometry, type Problem, ROOT } from './problem.js'
import type { Ranks } from './ranks.js'
import type { Scene } from './scene.js'
import type { Tracks, Var } from './tracks.js'
import { wiresOf } from './wires.js'

export interface Placed {
  geometry: Geometry
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  /** What the solution does not keep: separations short of their distance, values out of their room. */
  unmet: { separations: number; bounds: number }
  /** What the orders of the runs along the rows cost in crossings. */
  laneCrossings: number
  /** By gap, what each stage counts as crossings (a check: the stages should agree). */
  table: { gap: number; layers: number; lanesLeast: number; lanes: number; drawn: number }[]
  /** Each drawn crossing: the horizontal and the vertical line, the band, and where. */
  crossingList: {
    h: string
    v: string
    gap: number
    x: number
    y: number
    vFrom: number
    vTo: number
  }[]
}

/** The boxes of the items, the members of the units and the frames, from the solved axes. */
function boxesOf(
  plan: Pick<Plan, 'problem' | 'boxes'>,
  xAxis: Axis,
  yAxis: Axis,
  xValues: Float64Array,
  yValues: Float64Array,
): Geometry {
  const geom = new Map<string, Box>()
  for (const item of plan.problem.items) {
    const left = xValues[xAxis.lowRef(item.id).v] ?? 0
    const top = yValues[yAxis.lowRef(item.id).v] ?? 0
    geom.set(item.id, { x: left, y: top, ...item.size })
  }
  for (const [key, b] of plan.boxes) {
    if (key === b.item.id) continue
    const unit = geom.get(b.item.id)
    if (unit) geom.set(key, { x: unit.x + b.ox, y: unit.y + b.oy, width: b.w, height: b.h })
  }
  for (const f of plan.problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    const l = xValues[xAxis.lowRef(key).v] ?? 0
    const r = xValues[xAxis.highRef(key).v] ?? 0
    const t = yValues[yAxis.lowRef(key).v] ?? 0
    const b = yValues[yAxis.highRef(key).v] ?? 0
    geom.set(key, { x: l, y: t, width: r - l, height: b - t })
  }
  return { boxes: geom }
}

/** Every coordinate has its unknown before any constraint is laid. */
export function axesOf(
  plan: Pick<Plan, 'problem' | 'frameOfKey' | 'boxes' | 'frames' | 'find' | 'tracks'>,
) {
  const { tracks } = plan
  const yAxis = axisOf(plan, 'y')
  const xAxis = axisOf(plan, 'x')
  for (const lane of tracks.lanes.values()) {
    if (lane.used) (lane.axis === 'x' ? xAxis : yAxis).at({ kind: 'lane', key: lane.key })
  }
  for (const ent of tracks.entities.values())
    (ent.axis === 'x' ? xAxis : yAxis).at({ kind: 'port', id: ent.id })
  return { xAxis, yAxis }
}

/**
 * The two axes solved: 7a the widths, then 7b the runs along the rows (the last discrete
 * decision), then 7c the heights.
 */
export function solveAxes(plan: Plan) {
  const { xAxis, yAxis } = axesOf(plan)
  const xValues = placeX(plan, xAxis)
  const lanes = lanesOf(
    plan.problem,
    plan.corridors,
    plan.tracks,
    (v) => xValues[xAxis.at(v).v] ?? 0,
    plan.tolerance,
  )
  const { yValues, bands } = placeY(plan, xAxis, yAxis, xValues, lanes)
  return { xAxis, yAxis, xValues, yValues, bands, lanes }
}

/**
 * Where everything stands. The widths are solved first, then the order of the runs along each row
 * is read from them, then the heights, each axis as one system of separations and equalities
 * fixed by the orders of the stages before, so a length never changes an order. Only the stretches that were left a hair short of a straight line are
 * looked at once the widths are solved (the band a jog is too small to be drawn in).
 */
export function placeAll(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  corridors: Corridors,
  tracks: Tracks,
): Placed {
  const plan = planOf(problem, ranks, layers, corridors, tracks)
  const { xAxis, yAxis, xValues, yValues, bands, lanes } = solveAxes(plan)

  const geometry = boxesOf(plan, xAxis, yAxis, xValues, yValues)
  const value = (v: Var): number => {
    const lane = v.kind === 'lane' ? tracks.lanes.get(v.key) : undefined
    const axis = v.kind === 'port' ? tracks.entities.get(v.id)?.axis : lane?.axis
    return axis === 'x' ? (xValues[xAxis.at(v).v] ?? 0) : (yValues[yAxis.at(v).v] ?? 0)
  }
  const { wires, ports } = wiresOf(problem, geometry, tracks, value, lanes.dropped)
  return {
    geometry,
    wires,
    ports,
    ...auditCrossings(plan, wires, bands, yValues, lanes),
    unmet: {
      separations: shortOf(plan, yAxis.sys, yValues) + shortOf(plan, xAxis.sys, xValues),
      bounds: 0,
    },
    laneCrossings: lanes.crossings,
  }
}
