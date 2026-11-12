// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { frameIn, frameKey, isDummyKey } from './keys.js'
import { inHintOrder } from './layers/order.js'
import type { Layers } from './layers.js'
import type { FrameId, ItemId, Problem } from './problem.js'
import type { Ranks } from './ranks.js'

/**
 * The relative placement the layout settled on, before any coordinate: for each frame (a group's
 * id, or `''` for the top level), its children left to right, each with the rows it holds. It is
 * what a person's intent (`drawing.order`) speaks about, and where a drag is read against: the
 * slots a drop can take are the gaps between these children, in these rows. No length is in it.
 */
export interface Arrangement {
  frames: Readonly<Record<FrameId, readonly Placed[]>>
  /**
   * By frame, the ids of `drawing.order` the layout did not place as asked: a child that stands
   * where the structure puts it (a free item, a node beside its host), one named under a frame it
   * is not a child of, or one the stages left out of the order. An id the drawing has no child
   * for is not here: it is ignored, as a thing that is gone.
   */
  unmet: Readonly<Record<FrameId, readonly string[]>>
}

/** A child of a frame, by the id the configuration knows it by. */
export interface Placed {
  /** A node's id; a redundancy set's; a segment's; a routing domain's; a group's. */
  id: string
  kind: 'node' | 'unit' | 'segment' | 'domain' | 'group'
  /** The first and last row it holds: one row for a node, those of what a group contains. */
  rows: readonly [lo: number, hi: number]
  /** Whether an order is its to take: a free item or a node beside its host stands where the structure puts it. */
  movable: boolean
  /** A unit's members, left to right. */
  members?: readonly string[]
}

/** The order a person asked for, as `drawing.order` keeps it: by frame, the ids in order. */
export type OrderIntent = Readonly<Record<FrameId, readonly string[]>>

/**
 * The names an order may use, resolved to the keys the order stage knows: an item's id, a unit's
 * set id or one of its members, or a child frame's id. A name the drawing has no child for gives
 * nothing. The resolved keys come with the frame each is a child of, so a name written under the
 * wrong frame can be told from one the structure placed as asked.
 */
export function orderKeysOf(
  problem: Problem,
  intent: OrderIntent | undefined,
): {
  order: Map<FrameId, string[]>
  /** The frame each resolved key is a child of. */
  frameOf: Map<string, FrameId>
  /** The key a name written under `frame` stands for, if the drawing has a child for it. */
  keyOf(name: string, frame: FrameId): string | undefined
} {
  const owner = new Map<string, ItemId>()
  const frameOf = new Map<string, FrameId>()
  for (const item of problem.items) {
    owner.set(item.id, item.id)
    frameOf.set(item.id, item.frame)
    if (item.kind === 'unit') {
      owner.set(item.set, item.id)
      for (const m of item.members) owner.set(m.node.id, item.id)
    }
  }
  // a leaf group solved on its own is a child of its parent, named by the group's id (which wins
  // over a node of the same id, as a frame does)
  for (const item of problem.items) if (item.kind === 'frame') owner.set(item.group, item.id)
  const parentOf = new Map<FrameId, FrameId | undefined>()
  for (const f of problem.frames) {
    parentOf.set(f.id, f.parent)
    if (f.parent !== undefined) frameOf.set(frameKey(f.id), f.parent)
  }
  // A group may share an item's id: under the group's parent the name is the group's.
  const keyOf = (name: string, frame: FrameId): string | undefined => {
    if (parentOf.get(name) === frame && name !== frame) return frameKey(name)
    const item = owner.get(name)
    if (item !== undefined) return item
    return parentOf.get(name) !== undefined ? frameKey(name) : undefined
  }
  const order = new Map<FrameId, string[]>()
  for (const [frame, names] of Object.entries(intent ?? {})) {
    const keys = names.flatMap((name) => {
      const key = keyOf(name, frame)
      return key === undefined ? [] : [key]
    })
    if (keys.length > 0) order.set(frame, [...new Set(keys)])
  }
  return { order, frameOf, keyOf }
}

/** The arrangement the stages decided, read from their outputs; nothing is decided here. */
export function arrangementOf(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  intent: OrderIntent | undefined,
): Arrangement {
  const items = new Map(problem.items.map((i) => [i.id, i]))
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))
  const still = new Set<ItemId>([...problem.free, ...problem.satellites.map((s) => s.item)])
  const span = (key: string): readonly [number, number] => ranks.span.get(key) ?? [0, 0]

  const frames: Record<FrameId, Placed[]> = {}
  for (const f of problem.frames) {
    const placed: Placed[] = []
    for (const key of layers.siblings.get(f.id) ?? []) {
      if (isDummyKey(key)) continue
      const inner = frameIn(frameOfKey, key)
      if (inner !== undefined) {
        placed.push({ id: inner, kind: 'group', rows: span(key), movable: true })
        continue
      }
      const item = items.get(key)
      if (!item || item.kind === 'portal') continue
      if (item.kind === 'frame') {
        placed.push({ id: item.group, kind: 'group', rows: span(key), movable: true })
        continue
      }
      const base = { rows: span(key), movable: !still.has(key) }
      if (item.kind === 'unit') {
        const members = layers.members.get(key) ?? item.members.map((m) => m.node.id)
        placed.push({ id: item.set, kind: 'unit', ...base, members: [...members] })
      } else {
        const kind = item.kind === 'card' ? 'node' : item.kind === 'bus' ? 'segment' : 'domain'
        placed.push({ id: key, kind, ...base })
      }
    }
    frames[f.id] = placed
  }

  // What the order asked that the rows do not show: by the names the order used.
  const { frameOf, keyOf } = orderKeysOf(problem, intent)
  const unmet: Record<FrameId, string[]> = {}
  for (const [frame, names] of Object.entries(intent ?? {})) {
    const named = names.flatMap((name) => {
      const key = keyOf(name, frame)
      return key === undefined ? [] : [{ name, key }]
    })
    const inPlace = named.filter(
      ({ key }) => frameOf.get(key) === frame && !still.has(key) && !isDummyKey(key),
    )
    const standing = (layers.siblings.get(frame) ?? []).filter((k) =>
      inPlace.some((n) => n.key === k),
    )
    const kept = inHintOrder(
      standing,
      inPlace.map((n) => n.key),
    )
    const missed = named.filter(({ key }) => !kept.has(key)).map(({ name }) => name)
    if (missed.length > 0) unmet[frame] = missed
  }
  return { frames, unmet }
}
