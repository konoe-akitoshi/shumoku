// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Corridors } from './corridors.js'
import { auditCrossings } from './geometry/audit.js'
import { type Plan, planOf } from './geometry/plan.js'
import { type Axis, axisOf, shortOf } from './geometry/system.js'
import { placeX } from './geometry/x.js'
import { placeY } from './geometry/y.js'
import { lanesOf } from './lane-order.js'
import type { Layers } from './layers.js'
import type { Box, Point } from './metrics.js'
import { frameKey, type Geometry, type Problem, ROOT } from './problem.js'
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
  pl: Pick<Plan, 'problem' | 'boxes'>,
  X: Axis,
  Y: Axis,
  xv: Float64Array,
  yv: Float64Array,
): Geometry {
  const geom = new Map<string, Box>()
  for (const item of pl.problem.items) {
    const left = xv[X.lowRef(item.id).v] ?? 0
    const top = yv[Y.lowRef(item.id).v] ?? 0
    geom.set(item.id, { x: left, y: top, ...item.size })
  }
  for (const [key, b] of pl.boxes) {
    if (key === b.item.id) continue
    const unit = geom.get(b.item.id)
    if (unit) geom.set(key, { x: unit.x + b.ox, y: unit.y + b.oy, width: b.w, height: b.h })
  }
  for (const f of pl.problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    const l = xv[X.lowRef(key).v] ?? 0
    const r = xv[X.highRef(key).v] ?? 0
    const t = yv[Y.lowRef(key).v] ?? 0
    const b = yv[Y.highRef(key).v] ?? 0
    geom.set(key, { x: l, y: t, width: r - l, height: b - t })
  }
  return { boxes: geom }
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
  const pl = planOf(problem, ranks, layers, corridors, tracks)

  // every coordinate has its unknown before any constraint is laid
  const Y = axisOf(pl, 'y')
  const X = axisOf(pl, 'x')
  for (const lane of tracks.lanes.values()) {
    if (lane.used) (lane.axis === 'x' ? X : Y).at({ kind: 'lane', key: lane.key })
  }
  for (const ent of tracks.entities.values())
    (ent.axis === 'x' ? X : Y).at({ kind: 'port', id: ent.id })

  // 7a widths, then 7b the runs along the rows (the last discrete decision), then 7c heights
  const xv = placeX(pl, X)
  const lanes = lanesOf(problem, corridors, tracks, (v) => xv[X.at(v).v] ?? 0, pl.tolerance)
  const { yv, bands } = placeY(pl, X, Y, xv, lanes)

  const geometry = boxesOf(pl, X, Y, xv, yv)
  const value = (v: Var): number => {
    const lane = v.kind === 'lane' ? tracks.lanes.get(v.key) : undefined
    const axis = v.kind === 'port' ? tracks.entities.get(v.id)?.axis : lane?.axis
    return axis === 'x' ? (xv[X.at(v).v] ?? 0) : (yv[Y.at(v).v] ?? 0)
  }
  const { wires, ports } = wiresOf(problem, geometry, tracks, value, lanes.dropped)
  return {
    geometry,
    wires,
    ports,
    ...auditCrossings(pl, wires, bands, yv, lanes),
    unmet: { separations: shortOf(pl, Y.sys, yv) + shortOf(pl, X.sys, xv), bounds: 0 },
    laneCrossings: lanes.crossings,
  }
}
