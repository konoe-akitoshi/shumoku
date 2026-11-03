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
  top: Ref[]
  bottom: Ref[]
}

/** The flows put one item above another, and levels and satellites stand across. */
function flowHeights(pl: Plan, Y: Axis) {
  const { problem, ranks, metrics, tree, layers } = pl
  const ys = Y.sys
  const room = flowRoom(metrics)
  for (const { upper, lower } of problem.above)
    ys.sep.push(after(Y.highRef(upper), Y.lowRef(lower), room))
  // siblings the flows put one upstream of the other, a frame among them, stay one above the other
  for (const f of problem.frames) {
    const kids = pl.kidsOf(f.id)
    for (const [i, u] of kids.entries()) {
      for (const l of kids.slice(i + 1)) {
        if (!ranks.ordered(u, l) || !(pl.isFrame(u) || pl.isFrame(l))) continue
        const [su, sl] = [ranks.span.get(u), ranks.span.get(l)]
        if (!su || !sl) continue
        const [up, down] = su[1] < sl[0] ? [u, l] : [l, u]
        ys.sep.push(after(Y.highRef(up), Y.lowRef(down), metrics.groupGap))
      }
    }
  }
  for (const { a, b } of problem.level) ys.equal.push(same(Y.midRef(a), Y.midRef(b)))
  for (const s of problem.satellites) ys.equal.push(same(Y.midRef(s.item), Y.midRef(s.partner)))
  // an item without a place in the flow stands level with the first item of its rank in its frame
  const free = new Set(problem.free)
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const inside = new Set((tree.within.get(own.frame) ?? []).map((i) => i.id))
    const row = layers.sequences[ranks.rank.get(id) ?? 0] ?? []
    const first = row.find((e) => e.kind === 'box' && inside.has(e.item) && !free.has(e.item))
    if (first?.kind === 'box') ys.equal.push(same(Y.midRef(id), Y.midRef(first.item)))
  }
}

/**
 * Every rank is a band: its boxes lie between the band's top and bottom, and the band of the
 * next rank begins below. The runs along a row lie in the band of its gap, so that a vertical
 * leg only passes the bands of the two gaps it joins, and a row with nothing over or under a
 * run cannot let it fall anywhere.
 */
function rankBands(pl: Plan, Y: Axis): Bands {
  const { problem, ranks } = pl
  const ys = Y.sys
  const top: Ref[] = []
  const bottom: Ref[] = []
  for (let r = 0; r <= ranks.max; r++) {
    top.push({ v: Y.alloc(`y band top ${r}`), off: 0 })
    bottom.push({ v: Y.alloc(`y band bottom ${r}`), off: 0 })
  }
  for (const item of problem.items) {
    const r = ranks.rank.get(item.id) ?? 0
    const [t, b] = [top[r], bottom[r]]
    if (!t || !b) continue
    ys.sep.push(after(t, Y.lowRef(item.id), 0))
    ys.sep.push(after(Y.highRef(item.id), b, 0))
  }
  for (let r = 0; r < ranks.max; r++) {
    const [b, t] = [bottom[r], top[r + 1]]
    if (b && t) ys.sep.push(after(b, t, 0))
  }
  return { top, bottom }
}

/** The runs along the rows lie between what is over them and what is under. */
function laneHeights(pl: Plan, X: Axis, Y: Axis, xv: Float64Array, lanes: Lanes, bands: Bands) {
  const { metrics, tolerance, frames } = pl
  const ys = Y.sys
  const xAt = (r: Ref) => (xv[r.v] ?? 0) + r.off
  for (const [id, cell] of pl.corridors.nodes.entries()) {
    if (cell.kind !== 'cell') continue
    for (const key of lanes.order.get(id) ?? []) {
      const iv = lanes.interval.get(key)
      if (!iv) continue
      const h = pl.haloLane(key)
      const y = Y.at({ kind: 'lane', key })
      const above = bands.bottom[cell.gap]
      const below = bands.top[cell.gap + 1]
      if (above) ys.sep.push(after(above, y, keepOff(metrics, false) + h))
      if (below) ys.sep.push(after(y, below, h + keepOff(metrics, false)))
      const touches = (b: { key: string }) => {
        const [x0, x1] = [xAt(X.lowRef(b.key)), xAt(X.highRef(b.key))]
        return x0 < iv[1] + tolerance && iv[0] - tolerance < x1
      }
      for (const b of cell.over) {
        if (!touches(b)) continue
        if (b.frame) ys.sep.push(after(Y.highRef(b.key), y, whiteOf(metrics) + h))
        else
          ys.sep.push(after(Y.highRef(b.key), y, keepOff(metrics, pl.ported(b.key, 'bottom')) + h))
      }
      for (const b of cell.under) {
        if (!touches(b)) continue
        if (b.frame) ys.sep.push(after(y, Y.lowRef(b.key), h + whiteOf(metrics)))
        else ys.sep.push(after(y, Y.lowRef(b.key), h + keepOff(metrics, pl.ported(b.key, 'top'))))
      }
      if (cell.frame !== ROOT) {
        const fk = frameKey(cell.frame)
        const top = frames.get(cell.frame)?.insets.top ?? 0
        if (cell.topMargin) ys.sep.push(after(Y.lowRef(fk), y, top + h))
        if (cell.bottomMargin) ys.sep.push(after(y, Y.highRef(fk), h + whiteOf(metrics)))
      }
    }
  }
  for (const { a, b, d } of lanes.apart)
    ys.sep.push(after(Y.at({ kind: 'lane', key: a }), Y.at({ kind: 'lane', key: b }), d))
}

/**
 * The heights, once the widths and the order of the runs along the rows are known: flows, rank
 * bands, the runs between what lies over and under them, the ports. Returns the value of every
 * unknown of the axis, and the bands.
 */
export function placeY(
  pl: Plan,
  X: Axis,
  Y: Axis,
  xv: Float64Array,
  lanes: Lanes,
): { yv: Float64Array; bands: Bands } {
  flowHeights(pl, Y)
  const bands = rankBands(pl, Y)
  laneHeights(pl, X, Y, xv, lanes, bands)
  portChain(pl, Y, 'y')
  const room = flowRoom(pl.metrics)
  const spread = pl.problem.above.map(({ upper, lower }) => ({
    ...after(Y.highRef(upper), Y.lowRef(lower), room),
    w: 1,
  }))
  return { yv: solveCompact(pl, Y.sys, frameSpans(pl, Y), spread), bands }
}
