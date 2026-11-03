// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { frameKey } from './keys.js'
import { type Frame, type FrameId, type Item, type Problem, ROOT } from './problem.js'

/** The nesting of frames and items, looked up both ways. */
export interface Tree {
  /** The items directly in a frame. */
  itemsIn: Map<FrameId, Item[]>
  /** The frames directly in a frame. */
  framesIn: Map<FrameId, Frame[]>
  /** Every item in a frame, however deep. */
  within: Map<FrameId, Item[]>
  /** The frame of each item, and the parent of each frame, by key. */
  parentOf: Map<string, FrameId>
}

export function treeOf(problem: Problem): Tree {
  const itemsIn = new Map<FrameId, Item[]>()
  const framesIn = new Map<FrameId, Frame[]>()
  const parentOf = new Map<string, FrameId>()
  for (const f of problem.frames) itemsIn.set(f.id, [])
  for (const f of problem.frames) framesIn.set(f.id, [])
  for (const item of problem.items) {
    itemsIn.get(item.frame)?.push(item)
    parentOf.set(item.id, item.frame)
  }
  for (const f of problem.frames) {
    if (f.parent === undefined) continue
    framesIn.get(f.parent)?.push(f)
    parentOf.set(frameKey(f.id), f.parent)
  }
  const within = new Map<FrameId, Item[]>()
  const collect = (id: FrameId): Item[] => {
    const known = within.get(id)
    if (known) return known
    const all = [
      ...(itemsIn.get(id) ?? []),
      ...(framesIn.get(id) ?? []).flatMap((f) => collect(f.id)),
    ]
    within.set(id, all)
    return all
  }
  collect(ROOT)
  return { itemsIn, framesIn, within, parentOf }
}

/**
 * For each satellite, the element of its own frame that it stands beside: its partner, or the
 * frame the partner is in when that is deeper, and for a satellite of a satellite the element
 * the other one stands beside.
 */
export function anchorsOf(problem: Problem, tree: Tree): Map<string, string> {
  const items = new Map(problem.items.map((i) => [i.id, i]))
  const partner = new Map(problem.satellites.map((s) => [s.item, s.partner]))
  const anchors = new Map<string, string>()
  const resolve = (id: string, trail: ReadonlySet<string>): string => {
    const known = anchors.get(id)
    if (known !== undefined) return known
    const own = items.get(id)
    const target = partner.get(id)
    const there = target === undefined ? undefined : items.get(target)
    if (!own || target === undefined || !there || trail.has(id)) return id
    // Climb from the partner's frame to the frame whose parent is the satellite's own.
    let element: string = target
    for (let f: FrameId | undefined = there.frame; f !== undefined && f !== own.frame; ) {
      element = frameKey(f)
      f = tree.parentOf.get(frameKey(f))
    }
    if (there.frame === own.frame) element = target
    const anchor = partner.has(element) ? resolve(element, new Set(trail).add(id)) : element
    anchors.set(id, anchor)
    return anchor
  }
  for (const s of problem.satellites) resolve(s.item, new Set())
  return anchors
}
