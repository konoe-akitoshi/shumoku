// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { GroupId } from '../structure/types.js'
import { commonPlace } from '../structure/units.js'
import type { ElementId, Elements } from './elements.js'

/**
 * Layer 3. The order of what stands in each rank, left to right.
 *
 * A rank holds three kinds of slot: an element; a dummy, a point where a line passes through a
 * rank that is neither of its ends' (a line that spans several ranks has one in each rank
 * between); and a hold, which keeps a group's place in a rank where the group has nothing but
 * its frame passes through. A dummy belongs to the deepest group both ends are in. With the
 * holds, a group's frame crosses only the ranks it has a slot in, so whatever else stands in a
 * rank is on one side of the frame.
 *
 * Crossings between adjacent ranks are reduced by barycenter sweeps from several starts, the
 * best kept. Groups stay contiguous in every rank and nested inside their parents; sibling
 * groups are ordered by one key for the whole drawing, so they stand in the same order in every
 * rank. That key is fixed for the length of a sweep.
 */
export interface Slot {
  /** The element's id; `~line.<n>@<rank index>` for a dummy; `~hold.<group>@<rank index>`. */
  readonly id: string
  readonly kind: 'element' | 'dummy' | 'hold'
  /** Index of its rank among the ranks in use, from 0. */
  readonly layer: number
  /** The deepest group it belongs to. */
  readonly group?: GroupId
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
  const parents = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const byId = new Map(elements.elements.map((e) => [e.id, e]))
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
      ...(e.place === undefined ? {} : { group: e.place }),
    })
  }
  const paths: string[][] = []
  for (const line of elements.lines) {
    const [a, b] = line.ends
    const la = layerOf(a.element)
    const lb = layerOf(b.element)
    const group = commonPlace([byId.get(a.element)?.place, byId.get(b.element)?.place], parents)
    const between: string[] = []
    const step = la <= lb ? 1 : -1
    for (let layer = la + step; la !== lb && layer !== lb; layer += step) {
      const id = `~line.${line.index}@${layer}`
      add({
        id,
        kind: 'dummy',
        layer,
        line: line.index,
        ...(group === undefined ? {} : { group }),
      })
      between.push(id)
    }
    paths.push([a.element, ...between, b.element])
  }
  const chainOf = (group: GroupId | undefined): GroupId[] => {
    const chain: GroupId[] = []
    for (let g = group; g !== undefined; g = parents.get(g)) chain.push(g)
    return chain
  }
  // Holds: a group's slots may skip a rank that lies between two it has.
  for (const g of elements.groups) {
    const inside = slots.filter((s) => chainOf(s.group).includes(g.id))
    if (inside.length === 0) continue
    const first = Math.min(...inside.map((s) => s.layer))
    const last = Math.max(...inside.map((s) => s.layer))
    for (let layer = first; layer <= last; layer++) {
      if (inside.some((s) => s.layer === layer)) continue
      add({ id: `~hold.${g.id}@${layer}`, kind: 'hold', layer, group: g.id })
    }
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
  const chains = slots.map((s) => chainOf(s.group).reverse())
  const groupSlots = new Map<GroupId, number[]>()
  for (const [i, chain] of chains.entries()) {
    for (const g of chain) groupSlots.set(g, [...(groupSlots.get(g) ?? []), i])
  }

  type Placement = number[][]
  const fractions = (placement: Placement) => {
    const frac = slots.map(() => 0)
    for (const layer of placement) {
      for (const [i, s] of layer.entries()) frac[s] = (i + 0.5) / layer.length
    }
    return frac
  }

  /** Sorts one layer: groups nest, a leaf goes by its own key, a group by the group's key. */
  const sortLayer = (
    layer: readonly number[],
    leafKey: (s: number) => number,
    groupKey: ReadonlyMap<GroupId, number>,
  ): number[] => {
    interface Tree {
      leaves: number[]
      subs: Map<GroupId, Tree>
    }
    const root: Tree = { leaves: [], subs: new Map() }
    for (const s of layer) {
      let node = root
      for (const g of chains[s] ?? []) {
        let sub = node.subs.get(g)
        if (!sub) {
          sub = { leaves: [], subs: new Map() }
          node.subs.set(g, sub)
        }
        node = sub
      }
      node.leaves.push(s)
    }
    const flatten = (tree: Tree): number[] => {
      const items: { key: number; id: string; run: number[] }[] = [
        ...tree.leaves.map((s) => ({
          key: leafKey(s),
          id: slots[s]?.id ?? '',
          run: [s],
        })),
        ...[...tree.subs].map(([g, sub]) => ({
          key: groupKey.get(g) ?? 0,
          id: `~group.${g}`,
          run: flatten(sub),
        })),
      ]
      items.sort((a, b) => a.key - b.key || compare(a.id, b.id))
      return items.flatMap((i) => i.run)
    }
    return flatten(root)
  }

  const mean = (values: readonly number[], fallback: number) =>
    values.length === 0 ? fallback : values.reduce((a, b) => a + b, 0) / values.length

  /** The key of each group: where its slots would like to be, taken together. */
  const groupKeys = (wanted: (s: number) => number) =>
    new Map<GroupId, number>(
      [...groupSlots].map(([g, members]) => [g, mean(members.map(wanted), 0)]),
    )

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
    const seed = slots.map((s, i) => {
      if (s.kind === 'element') return index.get(s.id) ?? 0
      if (s.kind === 'dummy') {
        const [a, b] = elements.lines[s.line ?? 0]?.ends ?? []
        return mean([index.get(a?.element ?? '') ?? 0, index.get(b?.element ?? '') ?? 0], 0)
      }
      return mean(
        (groupSlots.get(s.group ?? '') ?? [])
          .filter((m) => slots[m]?.kind === 'element')
          .map((m) => index.get(slots[m]?.id ?? '') ?? 0),
        i,
      )
    })
    const keys = groupKeys((s) => seed[s] ?? 0)
    return initial.map((layer) => sortLayer(layer, (s) => seed[s] ?? 0, keys))
  }

  const sweeps = (start: Placement): { placement: Placement; crossings: number } => {
    let placement = start
    let best = { placement, crossings: crossingsOf(placement) }
    let stale = 0
    for (let sweep = 0; sweep < 40 && stale < 6; sweep++) {
      const downward = sweep % 2 === 0
      const frac = fractions(placement)
      const wanted = (s: number) =>
        mean(
          [...(up[s] ?? []), ...(down[s] ?? [])].map((n) => frac[n] ?? 0),
          frac[s] ?? 0,
        )
      const keys = groupKeys(wanted)
      const next = placement.map((layer) => [...layer])
      // The layer the sweep starts from has no neighbours on the side it came from, so it
      // goes by the other side; every layer is sorted with this sweep's keys.
      const order = Array.from({ length: layerCount }, (_, i) =>
        downward ? i : layerCount - 1 - i,
      )
      for (const [n, l] of order.entries()) {
        const fixed = (downward ? n > 0 : n === 0) ? up : down
        const known = fractions(next)
        next[l] = sortLayer(
          next[l] ?? [],
          (s) =>
            mean(
              (fixed[s] ?? []).map((m) => known[m] ?? 0),
              known[s] ?? 0,
            ),
          keys,
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
