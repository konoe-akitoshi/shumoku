// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { type FrameId, frameKey, type ItemId, type Problem } from './problem.js'
import { treeOf } from './tree.js'

/**
 * The siblings of one frame that may be stacked, one above the other, and the cuts between
 * which they may be told apart. An element is an item id or a `frameKey`.
 */
export interface Stackable {
  frame: FrameId
  /**
   * How far each sibling is from the head of the flow among its siblings: a tool for naming
   * the cuts, not a height. Siblings the flow says nothing about are all at layer 0.
   */
  layers: Map<string, number>
  /** Pairs where the flow says `upper` is upstream of `lower`, with the cuts `[from, to)` between them. */
  pairs: { upper: string; lower: string; from: number; to: number }[]
}

/** The key under which `Problem.stack` holds whether the cut `k` of a frame is on. */
export const cutKey = (frame: FrameId, k: number): string => `${frame}\0${k}`

/** The number of cuts of a frame: one between each two layers that follow each other. */
export const cutsOf = (s: Stackable): number => Math.max(0, ...s.layers.values())

/**
 * Lifts the flows to the siblings. A flow between two items says nothing about the frames
 * around them until it is read at the level where they are told apart: of the children of a
 * frame, one is upstream of another when anything inside the first is above anything inside
 * the second. Whatever is upstream may be stacked above what is downstream without making up
 * a vertical order the flows do not already state; siblings the flows do not relate are never
 * stacked, since one would then look downstream of the other.
 *
 * The result has one entry for each frame, the root included, in the order of `problem.frames`.
 */
export function liftFlows(problem: Problem): Stackable[] {
  const tree = treeOf(problem)
  const itemFrame = new Map(problem.items.map((i) => [i.id, i.frame]))
  const parentOf = tree.parentOf

  /** The child of `frame` that holds item `id`, or undefined if it is not inside `frame`. */
  const childOf = (id: ItemId, frame: FrameId): string | undefined => {
    let at: FrameId | undefined = itemFrame.get(id)
    if (at === undefined) return undefined
    if (at === frame) return id
    for (;;) {
      const up: FrameId | undefined = parentOf.get(frameKey(at))
      if (up === frame) return frameKey(at)
      if (up === undefined) return undefined
      at = up
    }
  }

  return problem.frames.map((f): Stackable => {
    const kids = [
      ...(tree.itemsIn.get(f.id) ?? []).map((i) => i.id),
      ...(tree.framesIn.get(f.id) ?? []).map((g) => frameKey(g.id)),
    ].sort(compare)
    const out = new Map<string, Set<string>>(kids.map((k) => [k, new Set()]))
    for (const { upper, lower } of problem.above) {
      const u = childOf(upper, f.id)
      const l = childOf(lower, f.id)
      if (u !== undefined && l !== undefined && u !== l) out.get(u)?.add(l)
    }

    // Strongly connected components (Tarjan): siblings that are each upstream of the other
    // cannot be stacked either way.
    const index = new Map<string, number>()
    const low = new Map<string, number>()
    const stack: string[] = []
    const onStack = new Set<string>()
    const comp = new Map<string, number>()
    let counter = 0
    let comps = 0
    const visit = (v: string) => {
      index.set(v, counter)
      low.set(v, counter)
      counter++
      stack.push(v)
      onStack.add(v)
      for (const w of [...(out.get(v) ?? [])].sort(compare)) {
        if (!index.has(w)) {
          visit(w)
          low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0))
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0))
        }
      }
      if (low.get(v) === index.get(v)) {
        for (;;) {
          const w = stack.pop()
          if (w === undefined) break
          onStack.delete(w)
          comp.set(w, comps)
          if (w === v) break
        }
        comps++
      }
    }
    for (const k of kids) if (!index.has(k)) visit(k)

    // The components form a DAG; Tarjan numbers them with downstream ones first.
    const next: Set<number>[] = Array.from({ length: comps }, () => new Set())
    for (const [v, ws] of out) {
      for (const w of ws) {
        const a = comp.get(v)
        const b = comp.get(w)
        if (a !== undefined && b !== undefined && a !== b) next[a]?.add(b)
      }
    }
    const reach: Set<number>[] = Array.from({ length: comps }, () => new Set())
    // A component's successors have smaller numbers, so ascending order sees them first.
    for (let c = 0; c < comps; c++) {
      const r = reach[c]
      for (const d of next[c] ?? []) {
        r?.add(d)
        for (const e of reach[d] ?? []) r?.add(e)
      }
    }
    // A layer is the length of the longest path down from a source; sources are 0.
    const layer: number[] = new Array<number>(comps).fill(0)
    for (let c = comps - 1; c >= 0; c--) {
      for (const d of next[c] ?? []) layer[d] = Math.max(layer[d] ?? 0, (layer[c] ?? 0) + 1)
    }

    const layers = new Map(kids.map((k) => [k, layer[comp.get(k) ?? 0] ?? 0]))
    const pairs: Stackable['pairs'] = []
    for (const u of kids) {
      for (const l of kids) {
        const a = comp.get(u)
        const b = comp.get(l)
        if (a === undefined || b === undefined || a === b) continue
        if (reach[a]?.has(b)) {
          pairs.push({ upper: u, lower: l, from: layers.get(u) ?? 0, to: layers.get(l) ?? 0 })
        }
      }
    }
    return { frame: f.id, layers, pairs }
  })
}
