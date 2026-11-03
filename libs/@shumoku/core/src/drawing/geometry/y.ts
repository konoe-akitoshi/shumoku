// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { flowRoom, keepOff, whiteOf } from '../kin.js'
import type { Lanes } from '../lane-order.js'
import { frameKey, ROOT } from '../problem.js'
import type { Plan } from './plan.js'
import { type Axis, after, frameSpans, portChain, type Ref, same, solveCompact } from './system.js'

/** The top and bottom of each rank's band, by rank. */
export interface Bands {
  readonly top: readonly Ref[]
  readonly bottom: readonly Ref[]
}

/** The flows put one item above another, and levels and satellites stand across. */
function flowHeights(
  plan: Pick<Plan, 'problem' | 'ranks' | 'metrics' | 'tree' | 'layers' | 'kidsOf' | 'isFrame'>,
  yAxis: Axis,
) {
  const { problem, ranks, metrics, tree, layers } = plan
  const ySys = yAxis.sys
  const room = flowRoom(metrics)
  for (const { upper, lower } of problem.above)
    ySys.sep.push(after(yAxis.highRef(upper), yAxis.lowRef(lower), room))
  // siblings the flows put one upstream of the other, a frame among them, stay one above the other
  for (const f of problem.frames) {
    const kids = plan.kidsOf(f.id)
    for (const [i, u] of kids.entries()) {
      for (const l of kids.slice(i + 1)) {
        if (!ranks.ordered(u, l) || !(plan.isFrame(u) || plan.isFrame(l))) continue
        const [su, sl] = [ranks.span.get(u), ranks.span.get(l)]
        if (!su || !sl) continue
        const [up, down] = su[1] < sl[0] ? [u, l] : [l, u]
        ySys.sep.push(after(yAxis.highRef(up), yAxis.lowRef(down), metrics.groupGap))
      }
    }
  }
  for (const { a, b } of problem.level) ySys.equal.push(same(yAxis.midRef(a), yAxis.midRef(b)))
  for (const s of problem.satellites)
    ySys.equal.push(same(yAxis.midRef(s.item), yAxis.midRef(s.partner)))
  // an item without a place in the flow stands level with the first item of its rank in its frame
  const free = new Set(problem.free)
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const inside = new Set((tree.within.get(own.frame) ?? []).map((i) => i.id))
    const row = layers.sequences[ranks.rank.get(id) ?? 0] ?? []
    const first = row.find((e) => e.kind === 'box' && inside.has(e.item) && !free.has(e.item))
    if (first?.kind === 'box') ySys.equal.push(same(yAxis.midRef(id), yAxis.midRef(first.item)))
  }
}

/**
 * Every rank is a band: its boxes lie between the band's top and bottom, and the band of the
 * next rank begins below. The runs along a row lie in the band of its gap, so that a vertical
 * leg only passes the bands of the two gaps it joins, and a row with nothing over or under a
 * run cannot let it fall anywhere.
 */
function rankBands(plan: Pick<Plan, 'problem' | 'ranks'>, yAxis: Axis): Bands {
  const { problem, ranks } = plan
  const ySys = yAxis.sys
  const top: Ref[] = []
  const bottom: Ref[] = []
  for (let r = 0; r <= ranks.max; r++) {
    top.push({ v: yAxis.alloc(`y band top ${r}`), off: 0 })
    bottom.push({ v: yAxis.alloc(`y band bottom ${r}`), off: 0 })
  }
  for (const item of problem.items) {
    const r = ranks.rank.get(item.id) ?? 0
    const [t, b] = [top[r], bottom[r]]
    if (!t || !b) continue
    ySys.sep.push(after(t, yAxis.lowRef(item.id), 0))
    ySys.sep.push(after(yAxis.highRef(item.id), b, 0))
  }
  for (let r = 0; r < ranks.max; r++) {
    const [b, t] = [bottom[r], top[r + 1]]
    if (b && t) ySys.sep.push(after(b, t, 0))
  }
  return { top, bottom }
}

/** The runs along the rows lie between what is over them and what is under. */
function laneHeights(
  plan: Pick<Plan, 'metrics' | 'tolerance' | 'frames' | 'corridors' | 'haloLane' | 'ported'>,
  xAxis: Axis,
  yAxis: Axis,
  xValues: Float64Array,
  lanes: Lanes,
  bands: Bands,
) {
  const { metrics, tolerance, frames } = plan
  const ySys = yAxis.sys
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
      if (above) ySys.sep.push(after(above, y, keepOff(metrics, false) + h))
      if (below) ySys.sep.push(after(y, below, h + keepOff(metrics, false)))
      const touches = (b: { key: string }) => {
        const [x0, x1] = [xAt(xAxis.lowRef(b.key)), xAt(xAxis.highRef(b.key))]
        return x0 < iv[1] + tolerance && iv[0] - tolerance < x1
      }
      for (const b of cell.over) {
        if (!touches(b)) continue
        if (b.frame) ySys.sep.push(after(yAxis.highRef(b.key), y, whiteOf(metrics) + h))
        else
          ySys.sep.push(
            after(yAxis.highRef(b.key), y, keepOff(metrics, plan.ported(b.key, 'bottom')) + h),
          )
      }
      for (const b of cell.under) {
        if (!touches(b)) continue
        if (b.frame) ySys.sep.push(after(y, yAxis.lowRef(b.key), h + whiteOf(metrics)))
        else
          ySys.sep.push(
            after(y, yAxis.lowRef(b.key), h + keepOff(metrics, plan.ported(b.key, 'top'))),
          )
      }
      if (cell.frame !== ROOT) {
        const fk = frameKey(cell.frame)
        const top = frames.get(cell.frame)?.insets.top ?? 0
        if (cell.topMargin) ySys.sep.push(after(yAxis.lowRef(fk), y, top + h))
        if (cell.bottomMargin) ySys.sep.push(after(y, yAxis.highRef(fk), h + whiteOf(metrics)))
      }
    }
  }
  for (const { a, b, d } of lanes.apart)
    ySys.sep.push(after(yAxis.at({ kind: 'lane', key: a }), yAxis.at({ kind: 'lane', key: b }), d))
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
 * unknown of the axis, and the bands. The separations are added to `yAxis.sys`.
 */
export function placeY(
  plan: YPlan,
  xAxis: Axis,
  yAxis: Axis,
  xValues: Float64Array,
  lanes: Lanes,
): { yValues: Float64Array; bands: Bands } {
  flowHeights(plan, yAxis)
  const bands = rankBands(plan, yAxis)
  laneHeights(plan, xAxis, yAxis, xValues, lanes, bands)
  portChain(plan, yAxis, 'y')
  const room = flowRoom(plan.metrics)
  const spread = plan.problem.above.map(({ upper, lower }) => ({
    ...after(yAxis.highRef(upper), yAxis.lowRef(lower), room),
    w: 1,
  }))
  return { yValues: solveCompact(plan, yAxis.sys, frameSpans(plan, yAxis), spread), bands }
}
