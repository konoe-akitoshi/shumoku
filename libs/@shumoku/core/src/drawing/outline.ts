// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { GroupId } from '../structure/types.js'
import type { Frame, Placed } from './coords.js'
import type { Point } from './metrics.js'

/**
 * Layer 8a. The outline of a group's frame: the rectilinear polygon around its intervals, one
 * per layer, clockwise on the page, starting at the top-left corner of its first band.
 *
 * The top is the frame's top (the label band is in it) over the first layer's interval, the
 * bottom is the frame's bottom under the last layer's interval, and between two layers each
 * edge that moves sideways does so in the gap, at a height where nothing else is: below the
 * bottom of every frame that ends in the upper layer and above the top of every frame that
 * starts in the lower one. Edges that would cross if they stepped at one height step at
 * different heights in that stretch: of two edges moving the same way, the one that is farther
 * along the way goes first (an edge moving right steps after every edge to its right whose
 * old place its step would run over, and the same to the left), which is what keeps the
 * outlines of nested groups, and of groups that stand side by side, from crossing. Edges
 * moving opposite ways never meet.
 */
export function outlinesOf(placed: Pick<Placed, 'bands' | 'frames'>): Map<GroupId, Point[]> {
  const { bands, frames } = placed
  const last = (f: Frame) => f.first + f.intervals.length - 1
  const at = (f: Frame, layer: number) => f.intervals[layer - f.first]

  interface Move {
    readonly key: string
    readonly from: number
    readonly to: number
  }
  /** The height each moving edge steps at: by group, side and the layer it steps from. */
  const stepAt = new Map<string, number>()
  const keyOf = (group: GroupId, side: 'left' | 'right', layer: number) =>
    `${side}\u0000${layer}\u0000${group}`

  for (let b = 0; b + 1 < bands.length; b++) {
    const upper = bands[b]
    const lower = bands[b + 1]
    if (!upper || !lower) continue
    let lo = upper.bottom
    let hi = lower.top
    const moves: Move[] = []
    for (const [group, f] of frames) {
      if (last(f) === b) lo = Math.max(lo, f.box.y + f.box.height)
      if (f.first === b + 1) hi = Math.min(hi, f.box.y)
      const a = at(f, b)
      const c = at(f, b + 1)
      if (!a || !c) continue
      if (a.left !== c.left) moves.push({ key: keyOf(group, 'left', b), from: a.left, to: c.left })
      if (a.right !== c.right) {
        moves.push({ key: keyOf(group, 'right', b), from: a.right, to: c.right })
      }
    }
    if (moves.length === 0) continue

    // Of the edges moving the same way, the farthest along goes first; one that is not in the
    // way of another's step may go at the same height.
    const lane = new Map<string, number>()
    for (const direction of [1, -1]) {
      const going = moves
        .filter((m) => Math.sign(m.to - m.from) === direction)
        .sort((p, q) => direction * (q.from - p.from) || (p.key < q.key ? -1 : 1))
      for (const [i, m] of going.entries()) {
        let after = 0
        for (const ahead of going.slice(0, i)) {
          if (direction * (m.to - ahead.from) > 0)
            after = Math.max(after, (lane.get(ahead.key) ?? 0) + 1)
        }
        lane.set(m.key, after)
      }
    }
    const lanes = Math.max(...lane.values()) + 1
    for (const [key, k] of lane) stepAt.set(key, lo + ((k + 1) / (lanes + 1)) * (hi - lo))
  }

  const outlines = new Map<GroupId, Point[]>()
  for (const [group, f] of frames) {
    const n = f.intervals.length
    const first = f.intervals[0]
    const end = f.intervals[n - 1]
    if (!first || !end) continue
    const top = f.box.y
    const bottom = f.box.y + f.box.height
    const points: Point[] = [
      { x: first.left, y: top },
      { x: first.right, y: top },
    ]
    for (let k = 0; k + 1 < n; k++) {
      const a = f.intervals[k]
      const c = f.intervals[k + 1]
      const y = stepAt.get(keyOf(group, 'right', f.first + k))
      if (a && c && y !== undefined) points.push({ x: a.right, y }, { x: c.right, y })
    }
    points.push({ x: end.right, y: bottom }, { x: end.left, y: bottom })
    for (let k = n - 2; k >= 0; k--) {
      const a = f.intervals[k]
      const c = f.intervals[k + 1]
      const y = stepAt.get(keyOf(group, 'left', f.first + k))
      if (a && c && y !== undefined) points.push({ x: c.left, y }, { x: a.left, y })
    }
    outlines.set(group, points)
  }
  return outlines
}
