// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Corridors } from '../corridors.js'
import { haloOf } from '../ground.js'
import { cornerOf, snapOf } from '../kin.js'
import type { Layers } from '../layers.js'
import {
  type Frame,
  type FrameId,
  frameKey,
  type Item,
  type Line,
  linesById,
  type Problem,
} from '../problem.js'
import type { Ranks } from '../ranks.js'
import type { Tracks } from '../tracks.js'
import { treeOf } from '../tree.js'

/** A box on the page: an item, or a member of a unit at its place inside the unit's outline. */
export interface BoxInfo {
  readonly item: Item
  readonly ox: number
  readonly oy: number
  readonly w: number
  readonly h: number
}

/** What every stage of the placing reads: the stages before, and the lookups made from them. */
export interface Plan {
  readonly problem: Problem
  readonly ranks: Ranks
  readonly layers: Layers
  readonly corridors: Corridors
  readonly tracks: Tracks
  readonly metrics: Problem['metrics']
  readonly tree: ReturnType<typeof treeOf>
  readonly frames: ReadonlyMap<FrameId, Frame>
  readonly frameOfKey: ReadonlyMap<string, FrameId>
  readonly byLine: ReadonlyMap<string, Line>
  readonly tolerance: number
  readonly boxes: ReadonlyMap<string, BoxInfo>
  isFrame(key: string): boolean
  /** Whether some line leaves the box (or the unit's members) by the side. */
  ported(itemId: string, side: 'top' | 'bottom' | 'left' | 'right'): boolean
  /** The root of the coordinates that are one: a run carried on through several nodes, level ports. */
  find(key: string): string
  /** The children of a frame that stand in the rows (not the dummies). */
  kidsOf(frame: FrameId): string[]
  haloLane(key: string): number
  lineOfLane(key: string): Line | undefined
  /** The corner radius of a line. */
  corner(line: string): number
}

export function planOf(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  corridors: Corridors,
  tracks: Tracks,
): Plan {
  const { metrics } = problem
  const byLine = linesById(problem)
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))

  // ---- the boxes: items, and the members of units at their place inside the outline
  const boxes = new Map<string, BoxInfo>()
  for (const item of problem.items) {
    boxes.set(item.id, { item, ox: 0, oy: 0, w: item.size.width, h: item.size.height })
    if (item.kind !== 'unit') continue
    const sizes = new Map((item.members ?? []).map((m) => [m.node.id, m.size]))
    const tallest = Math.max(0, ...[...sizes.values()].map((s) => s.height))
    let at = metrics.hullPad
    for (const id of layers.members.get(item.id) ?? []) {
      const size = sizes.get(id)
      if (!size) continue
      boxes.set(id, {
        item,
        ox: at,
        oy: metrics.hullPad + (tallest - size.height) / 2,
        w: size.width,
        h: size.height,
      })
      at += size.width + metrics.memberGap
    }
  }

  // ---- the coordinates that are one: a run carried on through several nodes, level ports
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    const p = parent.get(k) ?? k
    if (p === k) return k
    const r = find(p)
    parent.set(k, r)
    return r
  }
  for (const [a, b] of tracks.joined) {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra, rb)
  }

  return {
    problem,
    ranks,
    layers,
    corridors,
    tracks,
    metrics,
    tree: treeOf(problem),
    frames: new Map(problem.frames.map((f) => [f.id, f])),
    frameOfKey,
    byLine,
    tolerance: snapOf(metrics),
    boxes,
    isFrame: (k) => frameOfKey.has(k),
    ported: (itemId, side) => {
      const item = boxes.get(itemId)?.item
      const keys = item?.kind === 'unit' ? (layers.members.get(itemId) ?? []) : [itemId]
      return keys.some((k) => (tracks.ports.get(`${k}\0${side}`)?.length ?? 0) > 0)
    },
    find,
    kidsOf: (f) => (layers.siblings.get(f) ?? []).filter((k) => !layers.dummies.has(k)),
    haloLane: (key) => {
      const l = tracks.lanes.get(key)
      const line = l ? byLine.get(l.line) : undefined
      return line ? haloOf(line) : 0
    },
    lineOfLane: (key) => byLine.get(tracks.lanes.get(key)?.line ?? ''),
    corner: (line) => {
      const l = byLine.get(line)
      return l ? cornerOf(metrics, l) : 0
    },
  }
}
