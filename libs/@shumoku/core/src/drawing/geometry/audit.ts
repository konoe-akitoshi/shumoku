// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Placed } from '../geometry.js'
import type { Lanes } from '../lane-order.js'
import type { Point } from '../metrics.js'
import type { Plan } from './plan.js'
import type { Bands } from './y.js'

interface Seg {
  line: string
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * The crossings that are drawn, told by the band they fall in, set beside what the stages before
 * counted: a check that the stages agree.
 */
export function auditCrossings(
  pl: Plan,
  wires: ReadonlyMap<string, Point[]>,
  bands: Bands,
  yv: Float64Array,
  lanes: Lanes,
): Pick<Placed, 'table' | 'crossingList'> {
  const { ranks, layers } = pl
  const spans = bands.top.map((t, r) => ({
    top: yv[t.v] ?? 0,
    bottom: yv[bands.bottom[r]?.v ?? 0] ?? 0,
  }))
  const gapAt = (y: number): number => {
    for (const [r, b] of spans.entries()) {
      if (y < b.top) return r - 1
      if (y <= b.bottom) return -2 - r
    }
    return ranks.max
  }
  const hs: Seg[] = []
  const vs: Seg[] = []
  for (const [line, pts] of wires) {
    for (const [k, a] of pts.entries()) {
      const b = pts[k + 1]
      if (!b) continue
      const seg = { line, x0: a.x, y0: a.y, x1: b.x, y1: b.y }
      if (Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.x - b.x) >= 1e-6) hs.push(seg)
      else if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) >= 1e-6) vs.push(seg)
    }
  }
  const drawn = new Map<number, number>()
  const crossingList: Placed['crossingList'] = []
  for (const h of hs) {
    for (const v of vs) {
      if (h.line === v.line) continue
      const [lo, hi] = [Math.min(h.x0, h.x1), Math.max(h.x0, h.x1)]
      const [top, bottom] = [Math.min(v.y0, v.y1), Math.max(v.y0, v.y1)]
      if (v.x0 > lo && v.x0 < hi && h.y0 > top && h.y0 < bottom) {
        const g = gapAt(h.y0)
        drawn.set(g, (drawn.get(g) ?? 0) + 1)
        crossingList.push({
          h: h.line,
          v: v.line,
          gap: g,
          x: v.x0,
          y: h.y0,
          vFrom: Math.min(v.y0, v.y1),
          vTo: Math.max(v.y0, v.y1),
        })
      }
    }
  }
  const table: Placed['table'] = []
  for (let g = -1; g <= ranks.max; g++) {
    const l = lanes.byGap.get(g)
    table.push({
      gap: g,
      layers: (layers.byGap.gap[g] ?? 0) + (layers.byGap.level[g] ?? 0),
      lanesLeast: l?.least ?? 0,
      lanes: l?.chosen ?? 0,
      drawn: drawn.get(g) ?? 0,
    })
  }
  for (const [g, n] of drawn)
    if (g <= -2) table.push({ gap: g, layers: 0, lanesLeast: 0, lanes: 0, drawn: n })
  return { table, crossingList }
}
