// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { frameKey } from '../keys.js'
import { flowRoom, keepOff, whiteOf } from '../kin.js'
import type { Lanes } from '../lane-order.js'
import { must } from '../must.js'
import { ROOT } from '../problem.js'
import type { Plan } from './plan.js'
import {
  type Axis,
  after,
  type Bands,
  type Constraints,
  frameSpans,
  join,
  portChain,
  type Ref,
  type Sep,
  type Sys,
  same,
  solveCompact,
  systemOf,
} from './system.js'

/**
 * Levels and satellites stand across, and frames the flows order stay one above the other. That
 * a flow puts one item above another needs no separation of its own: the ranks already put the
 * upper item in an earlier rank, and the rank bands keep every rank above the next.
 */
function flowHeights(
  plan: Pick<Plan, 'problem' | 'ranks' | 'metrics' | 'tree' | 'layers' | 'kidsOf' | 'isFrame'>,
  yAxis: Axis,
): Constraints {
  const { problem, ranks, metrics, tree, layers } = plan
  const sep: Sep[] = []
  const equal: Sep[] = []
  // siblings the flows put one upstream of the other, a frame among them, stay one above the other
  for (const f of problem.frames) {
    const kids = plan.kidsOf(f.id)
    for (const [i, u] of kids.entries()) {
      for (const l of kids.slice(i + 1)) {
        if (!ranks.ordered(u, l) || !(plan.isFrame(u) || plan.isFrame(l))) continue
        const [su, sl] = [ranks.span.get(u), ranks.span.get(l)]
        if (!su || !sl) continue
        // Only rows that lie wholly one above the other are stacked: where the ranks left the two
        // sharing a row, stacking them would ask the rank bands for the opposite order.
        const pair: readonly [string, string] | undefined =
          su[1] < sl[0] ? [u, l] : sl[1] < su[0] ? [l, u] : undefined
        if (!pair) continue
        sep.push(after(yAxis.highRef(pair[0]), yAxis.lowRef(pair[1]), metrics.groupGap))
      }
    }
  }
  for (const { a, b } of problem.level) equal.push(same(yAxis.midRef(a), yAxis.midRef(b)))
  for (const s of problem.satellites)
    equal.push(same(yAxis.midRef(s.item), yAxis.midRef(s.partner)))
  // an item without a place in the flow stands level with the first item of its rank in its frame
  const free = new Set(problem.free)
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const inside = new Set((tree.within.get(own.frame) ?? []).map((i) => i.id))
    const row = layers.sequences[must(ranks.rank, id, 'rank of item')] ?? []
    const first = row.find((e) => e.kind === 'box' && inside.has(e.item) && !free.has(e.item))
    if (first?.kind === 'box') equal.push(same(yAxis.midRef(id), yAxis.midRef(first.item)))
  }
  return { sep, equal, pair: [] }
}

/**
 * Every rank is a band: its boxes lie between the band's top and bottom, and the band of the
 * next rank begins the room of a flow below. This is the one place a rank is put above the next,
 * so every flow, from any rank to any later one, gets its room from it. The runs along a row lie
 * in the band of its gap, so that a vertical leg only passes the bands of the two gaps it joins,
 * and a row with nothing over or under a run cannot let it fall anywhere.
 */
function rankBands(plan: Pick<Plan, 'problem' | 'ranks' | 'metrics'>, yAxis: Axis): Constraints {
  const { problem, ranks } = plan
  const room = flowRoom(plan.metrics)
  const { top, bottom } = yAxis.bands
  const sep: Sep[] = []
  for (const item of problem.items) {
    const r = must(ranks.rank, item.id, 'rank of item')
    const [t, b] = [top[r], bottom[r]]
    if (!t || !b) continue
    sep.push(after(t, yAxis.lowRef(item.id), 0))
    sep.push(after(yAxis.highRef(item.id), b, 0))
  }
  for (let r = 0; r < ranks.max; r++) {
    const [b, t] = [bottom[r], top[r + 1]]
    if (b && t) sep.push(after(b, t, room))
  }
  return { sep, equal: [], pair: [] }
}

/** The runs along the rows lie between what is over them and what is under. */
function laneHeights(
  plan: Pick<Plan, 'metrics' | 'tolerance' | 'frames' | 'corridors' | 'haloLane' | 'ported'>,
  xAxis: Axis,
  yAxis: Axis,
  xValues: Float64Array,
  lanes: Lanes,
): Constraints {
  const { metrics, tolerance, frames } = plan
  const { bands } = yAxis
  const sep: Sep[] = []
  const xAt = (r: Ref) => (xValues[r.v] ?? 0) + r.off
  for (const [id, cell] of plan.corridors.nodes.entries()) {
    if (cell.kind !== 'cell') continue
    for (const key of lanes.order.get(id) ?? []) {
      const iv = lanes.interval.get(key)
      if (!iv) continue
      const h = plan.haloLane(key)
      const y = yAxis.at({ kind: 'lane', key })
      const above = bands.bottom[cell.gap]
      const below = bands.top[cell.gap + 1]
      if (above) sep.push(after(above, y, keepOff(metrics, false) + h))
      if (below) sep.push(after(y, below, h + keepOff(metrics, false)))
      const touches = (b: { key: string }) => {
        const [x0, x1] = [xAt(xAxis.lowRef(b.key)), xAt(xAxis.highRef(b.key))]
        return x0 < iv[1] + tolerance && iv[0] - tolerance < x1
      }
      for (const b of cell.over) {
        if (!touches(b)) continue
        if (b.frame) sep.push(after(yAxis.highRef(b.key), y, whiteOf(metrics) + h))
        else
          sep.push(
            after(yAxis.highRef(b.key), y, keepOff(metrics, plan.ported(b.key, 'bottom')) + h),
          )
      }
      for (const b of cell.under) {
        if (!touches(b)) continue
        if (b.frame) sep.push(after(y, yAxis.lowRef(b.key), h + whiteOf(metrics)))
        else
          sep.push(after(y, yAxis.lowRef(b.key), h + keepOff(metrics, plan.ported(b.key, 'top'))))
      }
      if (cell.frame !== ROOT) {
        const fk = frameKey(cell.frame)
        const top = must(frames, cell.frame, 'frame of cell').insets.top
        if (cell.topMargin) sep.push(after(yAxis.lowRef(fk), y, top + h))
        if (cell.bottomMargin) sep.push(after(y, yAxis.highRef(fk), h + whiteOf(metrics)))
      }
    }
  }
  for (const { a, b, d } of lanes.apart)
    sep.push(after(yAxis.at({ kind: 'lane', key: a }), yAxis.at({ kind: 'lane', key: b }), d))
  return { sep, equal: [], pair: [] }
}

/** What the heights read of the plan. */
export type YPlan = Parameters<typeof flowHeights>[0] &
  Parameters<typeof rankBands>[0] &
  Parameters<typeof laneHeights>[0] &
  Parameters<typeof portChain>[0] &
  Parameters<typeof solveCompact>[0]

/**
 * The heights, once the widths and the order of the runs along the rows are known: flows, rank
 * bands, the runs between what lies over and under them, the ports. Returns the value of every
 * unknown of the axis, the bands, and the system that was solved.
 */
export function placeY(
  plan: YPlan,
  xAxis: Axis,
  yAxis: Axis,
  xValues: Float64Array,
  lanes: Lanes,
): { yValues: Float64Array; bands: Bands; sys: Sys } {
  const sys = systemOf(
    yAxis,
    join(
      flowHeights(plan, yAxis),
      rankBands(plan, yAxis),
      laneHeights(plan, xAxis, yAxis, xValues, lanes),
      portChain(plan, yAxis, 'y'),
    ),
  )
  const room = flowRoom(plan.metrics)
  const spread = plan.problem.above.map(({ upper, lower }) => ({
    ...after(yAxis.highRef(upper), yAxis.lowRef(lower), room),
    w: 1,
  }))
  return {
    yValues: solveCompact(plan, sys, frameSpans(plan, yAxis), spread),
    bands: yAxis.bands,
    sys,
  }
}
