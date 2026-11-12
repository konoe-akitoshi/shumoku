// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Corridors } from '../corridors.js'
import { haloOf } from '../ground.js'
import {
  type FrameKey,
  frameKey,
  hasDummy,
  hasFrame,
  type LaneKey,
  sideKey,
  type VarKey,
} from '../keys.js'
import { cornerOf, keepOff, snapOf, whiteOf } from '../kin.js'
import type { Layers } from '../layers.js'
import { must } from '../must.js'
import {
  type Frame,
  type FrameId,
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
  readonly frameOfKey: ReadonlyMap<FrameKey, FrameId>
  readonly byLine: ReadonlyMap<string, Line>
  readonly tolerance: number
  readonly boxes: ReadonlyMap<string, BoxInfo>
  isFrame(key: string): boolean
  /** Whether the key is a group's box: a frame, or a leaf group solved on its own. */
  isGroup(key: string): boolean
  /** Whether some line leaves the box (or the unit's members) by the side. */
  ported(itemId: string, side: 'top' | 'bottom' | 'left' | 'right'): boolean
  /**
   * How far a line keeps from the side of a box: `keepOff`, and further where the names of the
   * ports reach out past that (a second row of chips). The white where no port leaves.
   */
  reach(itemId: string, side: 'top' | 'bottom' | 'left' | 'right'): number
  /** The root of the coordinates that are one: a run carried on through several nodes, level ports. */
  find(key: VarKey): VarKey
  /** The children of a frame that stand in the rows (not the dummies). */
  kidsOf(frame: FrameId): string[]
  haloLane(key: LaneKey): number
  lineOfLane(key: LaneKey): Line
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
    const sizes = new Map(item.members.map((m) => [m.node.id, m.size]))
    const tallest = Math.max(0, ...[...sizes.values()].map((s) => s.height))
    let at = metrics.hullPad
    for (const id of must(layers.members, item.id, 'members of unit')) {
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
  const parent = new Map<VarKey, VarKey>()
  const find = (k: VarKey): VarKey => {
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

  const lineOfLane = (key: LaneKey): Line =>
    must(byLine, must(tracks.lanes, key, 'line of lane').line, 'line of lane')

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
    isFrame: (k) => hasFrame(frameOfKey, k),
    isGroup: (k) => hasFrame(frameOfKey, k) || boxes.get(k)?.item.kind === 'frame',
    ported: (itemId, side) => {
      const item = boxes.get(itemId)?.item
      const keys =
        item?.kind === 'unit' ? must(layers.members, itemId, 'members of unit') : [itemId]
      return keys.some((k) => (tracks.ports.get(sideKey(k, side))?.length ?? 0) > 0)
    },
    reach: (itemId, side) => {
      const item = boxes.get(itemId)?.item
      const keys =
        item?.kind === 'unit' ? must(layers.members, itemId, 'members of unit') : [itemId]
      const ported = keys.filter((k) => (tracks.ports.get(sideKey(k, side))?.length ?? 0) > 0)
      if (ported.length === 0) return keepOff(metrics, false)
      return Math.max(
        keepOff(metrics, true),
        ...ported.map(
          (k) => (problem.portSides?.get(sideKey(k, side))?.depth ?? 0) + whiteOf(metrics),
        ),
      )
    },
    find,
    kidsOf: (f) =>
      must(layers.siblings, f, 'children of frame').filter((k) => !hasDummy(layers.dummies, k)),
    haloLane: (key) => haloOf(lineOfLane(key)),
    lineOfLane,
    corner: (line) => {
      const l = byLine.get(line)
      return l ? cornerOf(metrics, l) : 0
    },
  }
}
