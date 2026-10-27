// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { ElementId, Elements } from './elements.js'

/**
 * Layer 3. The order of what stands in each rank, left to right.
 *
 * A rank holds two kinds of slot: an element, and a dummy, a point where a line passes through a
 * rank that is neither of its ends' (a line that spans several ranks has one in each rank
 * between). The elements are those of one level of `compound.ts`, where a group is already one
 * block, so there are no groups to keep together here.
 *
 * Crossings between adjacent ranks are reduced by barycenter sweeps from several starts, the
 * best kept.
 */
export interface Slot {
  /** The element's id; `~line.<n>@<rank index>` for a dummy. */
  readonly id: string
  readonly kind: 'element' | 'dummy'
  /** Index of its rank among the ranks in use, from 0. */
  readonly layer: number
  readonly element?: ElementId
  /** For a dummy, the line it carries. */
  readonly line?: number
}

export interface Ordered {
  /** The rank each layer stands for, rising. */
  readonly ranks: readonly number[]
  /** Each layer's slots, left to right. */
  readonly layers: readonly (readonly Slot[])[]
  /** For each line, the slots it runs through from its first end to its second. */
  readonly paths: readonly (readonly string[])[]
  /** Crossings between lines of adjacent layers. */
  readonly crossings: number
}

export interface OrderOptions {
  /** Where the first order starts: the boundary points. */
  readonly start?: readonly ElementId[]
}

export function orderElements(
  elements: Elements,
  rank: ReadonlyMap<ElementId, number>,
  options: OrderOptions = {},
): Ordered {
  const ranks = [...new Set(rank.values())].sort((a, b) => a - b)
  const layerOfRank = new Map(ranks.map((r, i) => [r, i]))
  const layerOf = (id: ElementId) => layerOfRank.get(rank.get(id) ?? 0) ?? 0

  // ---- slots ----
  const slots: Slot[] = []
  const slotOf = new Map<string, number>()
  const add = (slot: Slot) => {
    slotOf.set(slot.id, slots.length)
    slots.push(slot)
  }
  for (const e of elements.elements) {
    add({
      id: e.id,
      kind: 'element',
      layer: layerOf(e.id),
      element: e.id,
    })
  }
  const paths: string[][] = []
  for (const line of elements.lines) {
    const [a, b] = line.ends
    const la = layerOf(a.element)
    const lb = layerOf(b.element)
    const between: string[] = []
    const step = la <= lb ? 1 : -1
    for (let layer = la + step; la !== lb && layer !== lb; layer += step) {
      const id = `~line.${line.index}@${layer}`
      add({ id, kind: 'dummy', layer, line: line.index })
      between.push(id)
    }
    paths.push([a.element, ...between, b.element])
  }
  // ---- lines between adjacent layers ----
  const up: number[][] = slots.map(() => [])
  const down: number[][] = slots.map(() => [])
  /** For each pair of adjacent layers, the slots joined as [upper, lower]. */
  const joins: [number, number][][] = ranks.map(() => [])
  for (const path of paths) {
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      if (next === undefined) continue
      const a = slotOf.get(id)
      const b = slotOf.get(next)
      if (a === undefined || b === undefined) continue
      const [upper, lower] = (slots[a]?.layer ?? 0) <= (slots[b]?.layer ?? 0) ? [a, b] : [b, a]
      if (slots[upper]?.layer === slots[lower]?.layer) continue
      up[lower]?.push(upper)
      down[upper]?.push(lower)
      joins[slots[upper]?.layer ?? 0]?.push([upper, lower])
    }
  }

  // ---- ordering ----
  const layerCount = ranks.length
  type Placement = number[][]
  const fractions = (placement: Placement) => {
    const frac = slots.map(() => 0)
    for (const layer of placement) {
      for (const [i, s] of layer.entries()) frac[s] = (i + 0.5) / layer.length
    }
    return frac
  }

  /** Sorts one layer by each slot's key, a tie by the slot's id. */
  const sortLayer = (layer: readonly number[], key: (s: number) => number): number[] =>
    [...layer].sort((a, b) => key(a) - key(b) || compare(slots[a]?.id ?? '', slots[b]?.id ?? ''))

  const mean = (values: readonly number[], fallback: number) =>
    values.length === 0 ? fallback : values.reduce((a, b) => a + b, 0) / values.length

  const initial: number[][] = ranks.map(() => [])
  for (const [i, s] of slots.entries()) {
    initial[s.layer]?.push(i)
  }

  const crossingsOf = (placement: Placement) => {
    const position = slots.map(() => 0)
    for (const layer of placement) for (const [i, s] of layer.entries()) position[s] = i
    let total = 0
    for (const pairs of joins) {
      const spans = pairs.map(([u, l]) => [position[u] ?? 0, position[l] ?? 0] as const)
      for (const [i, [u1, l1]] of spans.entries()) {
        for (const [u2, l2] of spans.slice(i + 1)) {
          if ((u1 - u2) * (l1 - l2) < 0) total++
        }
      }
    }
    return total
  }

  /** The first order of a start: slots go by when their elements are first met. */
  const seeded = (met: readonly ElementId[]): Placement => {
    const index = new Map(met.map((id, i) => [id, i / Math.max(1, met.length)]))
    const seed = slots.map((s) => {
      if (s.kind === 'element') return index.get(s.id) ?? 0
      const [a, b] = elements.lines[s.line ?? 0]?.ends ?? []
      return mean([index.get(a?.element ?? '') ?? 0, index.get(b?.element ?? '') ?? 0], 0)
    })
    return initial.map((layer) => sortLayer(layer, (s) => seed[s] ?? 0))
  }

  const sweeps = (start: Placement): { placement: Placement; crossings: number } => {
    let placement = start
    let best = { placement, crossings: crossingsOf(placement) }
    let stale = 0
    for (let sweep = 0; sweep < 40 && stale < 6; sweep++) {
      const downward = sweep % 2 === 0
      const next = placement.map((layer) => [...layer])
      // The layer the sweep starts from has no neighbours on the side it came from, so it
      // goes by the other side.
      const order = Array.from({ length: layerCount }, (_, i) =>
        downward ? i : layerCount - 1 - i,
      )
      for (const [n, l] of order.entries()) {
        const fixed = (downward ? n > 0 : n === 0) ? up : down
        const known = fractions(next)
        next[l] = sortLayer(next[l] ?? [], (s) =>
          mean(
            (fixed[s] ?? []).map((m) => known[m] ?? 0),
            known[s] ?? 0,
          ),
        )
      }
      placement = next
      const crossings = crossingsOf(placement)
      if (crossings < best.crossings) {
        best = { placement, crossings }
        stale = 0
      } else stale++
    }
    return best
  }

  // ---- starts ----
  const ids = elements.elements.map((e) => e.id)
  const adjacent = new Map<ElementId, ElementId[]>(ids.map((id) => [id, []]))
  for (const line of elements.lines) {
    const [a, b] = line.ends
    adjacent.get(a.element)?.push(b.element)
    adjacent.get(b.element)?.push(a.element)
  }
  const roots = [...(options.start ?? []).filter((id) => adjacent.has(id)), ...ids]
  const depthFirst = (): ElementId[] => {
    const seen = new Set<ElementId>()
    const met: ElementId[] = []
    const visit = (id: ElementId) => {
      if (seen.has(id)) return
      seen.add(id)
      met.push(id)
      for (const next of adjacent.get(id) ?? []) visit(next)
    }
    for (const root of roots) visit(root)
    return met
  }
  const breadthFirst = (): ElementId[] => {
    const met: ElementId[] = []
    const seen = new Set<ElementId>()
    for (const root of roots) {
      if (seen.has(root)) continue
      seen.add(root)
      const queue = [root]
      for (const id of queue) {
        met.push(id)
        for (const next of adjacent.get(id) ?? []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push(next)
        }
      }
    }
    return met
  }
  const starts = [depthFirst(), ids, breadthFirst(), [...ids].reverse()]

  let best: { placement: Placement; crossings: number } | undefined
  for (const met of starts) {
    const result = sweeps(seeded(met))
    if (!best || result.crossings < best.crossings) best = result
  }
  const final = best ?? { placement: initial, crossings: 0 }
  return {
    ranks,
    layers: final.placement.map((layer) => layer.flatMap((s) => slots[s] ?? [])),
    paths,
    crossings: final.crossings,
  }
}
