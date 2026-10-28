// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { laneCosts, laneOrder } from './crossing.js'
import type { Point } from './metrics.js'
import { outward } from './ports.js'
import type { Side } from './scene.js'

/** Lines that share a stretch of a corridor and run side by side along it. */
export interface Bundle {
  /** `h`: the lines run horizontally, at height `coord` before they were spread. */
  axis: 'h' | 'v'
  coord: number
  lo: number
  hi: number
  /** How many lines are side by side at the most. */
  lines: number
  /** How many of them place things; the rest lie over the drawing and are not its room's to ask for. */
  core: number
}

export interface Tracks {
  wires: Map<string, Point[]>
  bundles: Bundle[]
  /** How many bundles were ordered by a search that is not exhaustive (more than eight lines). */
  approximated: number
}

interface Seg {
  line: string
  index: number
  axis: 'h' | 'v'
  coord: number
  lo: number
  hi: number
  /** For a segment next to a port, which way the port faces along the segment's normal. */
  away: number
}

/**
 * Spreads lines that run along the same corridor into parallel tracks a pitch apart. Lines
 * overlapping on one coordinate form a bundle; the order inside it is the one, among all of
 * them, in which the lines cross least (`laneOrder`), each pair weighed by where and to which
 * side the two part at the ends of what they share, even when they go on together round a
 * corner. Since one order is chosen for the whole bundle, it cannot disagree with itself the
 * way a comparison of pairs can. A bundle is
 * centred on its corridor, except one next to a port, which stands off from the card by its
 * lead-out and spreads outward only.
 */
export function nudge(
  wires: ReadonlyMap<string, readonly Point[]>,
  sides: ReadonlyMap<string, [Side, Side]>,
  pitch: number,
  core?: ReadonlySet<string>,
): Tracks {
  const segs: Seg[] = []
  for (const [line, pts] of wires) {
    const n = pts.length
    for (let i = 1; i + 2 < n; i++) {
      const p = pts[i]
      const q = pts[i + 1]
      if (!p || !q || !pts[i - 1] || !pts[i + 2]) continue
      const axis = p.y === q.y ? 'h' : 'v'
      const [a, b] = axis === 'h' ? [p.x, q.x] : [p.y, q.y]
      const pair = sides.get(line)
      const side = i === 1 ? pair?.[0] : i + 3 === n ? pair?.[1] : undefined
      const away = side === undefined ? 0 : axis === 'h' ? outward[side].y : outward[side].x
      segs.push({
        line,
        index: i,
        axis,
        coord: axis === 'h' ? p.y : p.x,
        lo: Math.min(a, b),
        hi: Math.max(a, b),
        away,
      })
    }
  }

  const groups = new Map<string, Seg[]>()
  for (const s of segs) {
    const key = `${s.axis}\0${s.coord}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const out = new Map<string, { x: number; y: number }[]>(
    [...wires].map(([k, v]) => [k, v.map((p) => ({ ...p }))]),
  )
  const bundles: Bundle[] = []
  let approximated = 0
  for (const group of groups.values()) {
    group.sort((p, q) => p.lo - q.lo)
    let cluster: Seg[] = []
    let reach = Number.NEGATIVE_INFINITY
    const flush = () => {
      if (cluster.length > 0) spread(cluster)
      cluster = []
    }
    for (const s of group) {
      if (cluster.length > 0 && s.lo >= reach) flush()
      cluster.push(s)
      reach = cluster.length === 1 ? s.hi : Math.max(reach, s.hi)
    }
    flush()
  }

  function spread(cluster: Seg[]) {
    const first = cluster[0]
    if (!first) return
    const k = cluster.length
    const byLine = new Map(cluster.map((s) => [s.line, s]))
    const stretch = (line: string) => ({
      path: wires.get(line) ?? [],
      index: byLine.get(line)?.index ?? 0,
    })
    const { order, exact } = laneOrder(
      [...byLine.keys()].sort(compare),
      (a, b) => laneCosts(stretch(a), stretch(b))?.pBelow ?? 0,
    )
    if (!exact) approximated++
    const ordered = order.flatMap((line) => byLine.get(line) ?? [])
    const beside = cluster.find((s) => s.away !== 0)?.away ?? 0
    bundles.push({
      axis: first.axis,
      coord: first.coord,
      lo: Math.min(...cluster.map((s) => s.lo)),
      hi: Math.max(...cluster.map((s) => s.hi)),
      lines: k,
      core: core === undefined ? k : cluster.filter((s) => core.has(s.line)).length,
    })
    if (k < 2) return
    for (const [t, s] of ordered.entries()) {
      // Tracks run from the low side to the high side; next to a port they start at the card.
      const offset =
        beside === 0 ? (t - (k - 1) / 2) * pitch : (beside > 0 ? t : t - (k - 1)) * pitch
      const pts = out.get(s.line)
      const p = pts?.[s.index]
      const q = pts?.[s.index + 1]
      if (!p || !q) continue
      if (s.axis === 'h') {
        p.y = s.coord + offset
        q.y = s.coord + offset
      } else {
        p.x = s.coord + offset
        q.x = s.coord + offset
      }
    }
  }
  return { wires: out, bundles, approximated }
}
