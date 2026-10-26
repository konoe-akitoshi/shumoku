// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { GroupId } from '../structure/types.js'
import type { Elements } from './elements.js'
import type { Box, Metrics } from './metrics.js'
import type { Ordered } from './order.js'
import { type Separation, solveVpsc } from './vpsc.js'

/**
 * Layer 4. Coordinates for the ordered slots and the groups' frames.
 *
 * Across a layer, the sum of the squares of how far each line runs sideways is made least, with
 * the spacing as separation constraints that VPSC meets exactly: neighbours in a layer keep
 * their half widths and a gap apart. A group's frame is not one rectangle but an interval in
 * each layer it spans (a pair of variables, left and right, for each layer, with the holds
 * keeping the group present in every layer between its first and its last). In a layer, the
 * interval holds the group's slots with the group's insets, holds the intervals of the groups
 * inside it with the parent's insets, keeps clear of whatever stands next to the group in that
 * layer (one constraint on each side is enough, because the order inside a layer is already
 * kept), and keeps a group gap from the sibling groups that stand in that layer too. Nothing
 * ties a layer's intervals to another layer's, so a group that goes deeper than its sibling
 * can reach under it, and the width of the drawing is what the widest layer needs, not what
 * the sum of the widest layers of the siblings needs.
 *
 * The objective is solved by repeating: every slot wants the weighted mean of the slots it is
 * joined to (a line between two real elements weighs 1, one with a dummy end 2, between two
 * dummies 8, so that long lines run straight), VPSC finds the nearest positions that keep the
 * constraints, and the next round starts from there. Each edge of an interval wants to be
 * tight around what the interval holds, and a little toward the same edge of the same group in
 * the layers above and below (see `STRAIGHTEN`), which keeps the outline simple wherever
 * nothing else gets in the way. A hold wants the middle of its group in the layers above and
 * below, so that a group passing through a layer goes straight through.
 *
 * Down the page, a layer is as tall as its tallest element and the gap between layers is at
 * least the lead-outs at both ends and one line pitch, and more where a group's frame starts or
 * ends: the frame's insets (label band included) are added once for each frame that starts there.
 */
export interface Interval {
  readonly left: number
  readonly right: number
}

/** A group's frame. */
export interface Frame {
  /** The smallest box around the whole frame. */
  readonly box: Box
  /** The first layer it spans. */
  readonly first: number
  /** Where it stands across in each layer it spans, from `first` down. */
  readonly intervals: readonly Interval[]
}

export interface Placed {
  /** The centre of each slot, across. */
  readonly x: ReadonlyMap<string, number>
  /** The centre line of each layer, down. */
  readonly y: readonly number[]
  /** The band each layer takes down the page: as tall as its tallest element. */
  readonly bands: readonly { readonly top: number; readonly bottom: number }[]
  /** The frame of each group that has anything in it. */
  readonly frames: ReadonlyMap<GroupId, Frame>
}

/**
 * How much an edge of an interval minds being away from the same edge in the layer above and
 * the layer below, as a share of how much it minds being away from tight around its contents
 * (which counts 1). Light: a frame hugs its contents, and takes a straighter outline only
 * where that costs the layer nothing.
 */
const STRAIGHTEN = 1 / 4
/** What a hold minds being off the middle of its group in a neighbouring layer: a dummy's weight. */
const THROUGH = 8

export function placeCoords(elements: Elements, ordered: Ordered, metrics: Metrics): Placed {
  const sizes = new Map(elements.elements.map((e) => [e.id, e.size]))
  const parents = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const chainOf = (group: GroupId | undefined): GroupId[] => {
    const chain: GroupId[] = []
    for (let g = group; g !== undefined; g = parents.get(g)) chain.push(g)
    return chain
  }

  const flat = ordered.layers.flat()
  const index = new Map(flat.map((s, i) => [s.id, i]))
  const width = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.width ?? 0) : 0))
  const height = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.height ?? 0) : 0))
  const real = flat.map((s) => s.kind === 'element')

  // ---- groups in use, where each stands in each layer ----
  /** For a group, in a layer: the first and last position of its slots, and how many it has. */
  const runs = new Map<GroupId, Map<number, { first: number; last: number }>>()
  /** The slots of a group in a layer that are its own, and not those of a group inside it. */
  const direct = new Map<GroupId, Map<number, number[]>>()
  const members = new Map<GroupId, number[]>()
  for (const [layerIndex, layer] of ordered.layers.entries()) {
    const seen = new Map<GroupId, { first: number; last: number; count: number }>()
    for (const [i, s] of layer.entries()) {
      const slot = index.get(s.id) ?? 0
      for (const g of chainOf(s.group)) {
        const run = seen.get(g)
        if (run) {
          run.last = i
          run.count++
        } else seen.set(g, { first: i, last: i, count: 1 })
        members.set(g, [...(members.get(g) ?? []), slot])
      }
      if (s.group !== undefined) {
        const byLayer = direct.get(s.group) ?? new Map<number, number[]>()
        byLayer.set(layerIndex, [...(byLayer.get(layerIndex) ?? []), slot])
        direct.set(s.group, byLayer)
      }
    }
    for (const [g, run] of seen) {
      if (run.last - run.first + 1 !== run.count) {
        throw new Error(`group ${g} is not contiguous in layer ${layerIndex}`)
      }
      runs.set(g, (runs.get(g) ?? new Map()).set(layerIndex, { first: run.first, last: run.last }))
    }
  }
  const used = elements.groups.filter((g) => runs.has(g.id))
  const depth = (g: GroupId) => chainOf(g).length
  const inset = (g: GroupId) => metrics.group(g)
  /** The layers a group spans, top to bottom; the holds leave none out. */
  const layersOf = new Map<GroupId, number[]>()
  for (const g of used) {
    const layers = [...(runs.get(g.id)?.keys() ?? [])].sort((a, b) => a - b)
    const first = layers[0] ?? 0
    for (const [k, layer] of layers.entries()) {
      if (layer !== first + k) throw new Error(`group ${g.id} skips layer ${first + k}`)
    }
    layersOf.set(g.id, layers)
  }
  const childrenOf = new Map<GroupId, GroupId[]>()
  for (const g of used) {
    if (g.parent !== undefined)
      childrenOf.set(g.parent, [...(childrenOf.get(g.parent) ?? []), g.id])
  }

  // ---- variables: the slots, then a left and a right edge for each group in each layer ----
  const left = new Map<GroupId, Map<number, number>>()
  const right = new Map<GroupId, Map<number, number>>()
  const edges: { group: GroupId; layer: number }[] = []
  let count = flat.length
  for (const g of used) {
    const l = new Map<number, number>()
    const r = new Map<number, number>()
    for (const layer of layersOf.get(g.id) ?? []) {
      l.set(layer, count++)
      r.set(layer, count++)
      edges.push({ group: g.id, layer })
    }
    left.set(g.id, l)
    right.set(g.id, r)
  }
  const leftOf = (g: GroupId, layer: number) => left.get(g)?.get(layer)
  const rightOf = (g: GroupId, layer: number) => right.get(g)?.get(layer)

  // ---- constraints ----
  const apart = (a: number, b: number) => {
    const bothReal = real[a] && real[b]
    const neither = !real[a] && !real[b]
    const spacing = bothReal
      ? metrics.gap
      : neither
        ? metrics.pitch
        : Math.max(metrics.pitch, metrics.gap / 2)
    return (width[a] ?? 0) / 2 + (width[b] ?? 0) / 2 + spacing
  }
  const outside = (s: number) => (width[s] ?? 0) / 2 + (real[s] ? metrics.gap : metrics.pitch)
  const constraints: Separation[] = []
  const must = (l: number | undefined, r: number | undefined, gap: number) => {
    if (l !== undefined && r !== undefined) constraints.push({ left: l, right: r, gap })
  }
  for (const layer of ordered.layers) {
    for (const [i, s] of layer.entries()) {
      const next = layer[i + 1]
      if (next)
        must(
          index.get(s.id),
          index.get(next.id),
          apart(index.get(s.id) ?? 0, index.get(next.id) ?? 0),
        )
    }
  }
  for (const g of used) {
    const pad = inset(g.id)
    for (const layer of layersOf.get(g.id) ?? []) {
      const l = leftOf(g.id, layer)
      const r = rightOf(g.id, layer)
      for (const m of direct.get(g.id)?.get(layer) ?? []) {
        must(l, m, (width[m] ?? 0) / 2 + pad.left)
        must(m, r, (width[m] ?? 0) / 2 + pad.right)
      }
      if (g.parent !== undefined) {
        const outer = inset(g.parent)
        must(leftOf(g.parent, layer), l, outer.left)
        must(r, rightOf(g.parent, layer), outer.right)
      }
    }
  }
  for (const [layerIndex, layer] of ordered.layers.entries()) {
    // The slot just outside a group's run keeps clear of the group's interval in this layer.
    const siblings = new Map<GroupId | undefined, { group: GroupId; first: number }[]>()
    for (const g of used) {
      const run = runs.get(g.id)?.get(layerIndex)
      if (!run) continue
      const before = layer[run.first - 1]
      const after = layer[run.last + 1]
      const beforeAt = before === undefined ? undefined : index.get(before.id)
      const afterAt = after === undefined ? undefined : index.get(after.id)
      if (beforeAt !== undefined) must(beforeAt, leftOf(g.id, layerIndex), outside(beforeAt))
      if (afterAt !== undefined) must(rightOf(g.id, layerIndex), afterAt, outside(afterAt))
      siblings.set(g.parent, [...(siblings.get(g.parent) ?? []), { group: g.id, first: run.first }])
    }
    // Sibling groups that stand in this layer keep a group gap between their intervals here, in
    // the order the layer has them (the order is the same in every layer, so outlines never cross).
    for (const list of siblings.values()) {
      const side = [...list].sort((a, b) => a.first - b.first)
      for (const [i, a] of side.entries()) {
        const b = side[i + 1]
        if (b) must(rightOf(a.group, layerIndex), leftOf(b.group, layerIndex), metrics.groupGap)
      }
    }
  }

  // ---- across ----
  // The lines between adjacent layers, with how much each is worth keeping straight.
  const joined: [number, number, number][] = []
  for (const path of ordered.paths) {
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      const a = index.get(id)
      const b = next === undefined ? undefined : index.get(next)
      if (a === undefined || b === undefined || flat[a]?.layer === flat[b]?.layer) continue
      const dummies = Number(!real[a]) + Number(!real[b])
      joined.push([a, b, dummies === 0 ? 1 : dummies === 1 ? 2 : 8])
    }
  }
  const pulls: [number, number][][] = flat.map(() => [])
  for (const [a, b, w] of joined) {
    pulls[a]?.push([b, w])
    pulls[b]?.push([a, w])
  }

  // Each layer packed to its smallest, centred on 0.
  const x = flat.map(() => 0)
  for (const layer of ordered.layers) {
    let at = 0
    for (const [i, s] of layer.entries()) {
      const here = index.get(s.id) ?? 0
      const before = layer[i - 1]
      if (before) at += apart(index.get(before.id) ?? 0, here)
      x[here] = at
    }
    for (const s of layer) x[index.get(s.id) ?? 0] = (x[index.get(s.id) ?? 0] ?? 0) - at / 2
  }

  const deepestFirst = [...used].sort((a, b) => depth(b.id) - depth(a.id))
  /**
   * Where each edge would like to be: tight around what its interval holds (the group's own
   * slots and the intervals of the groups inside), and a little toward the same edge in the
   * layers next to it, as they were in `frame` (the previous round) when there is one.
   */
  const edgeWants = (current: readonly number[], frame: readonly number[] | undefined) => {
    const tightLeft = new Map<GroupId, Map<number, number>>()
    const tightRight = new Map<GroupId, Map<number, number>>()
    for (const g of deepestFirst) {
      const pad = inset(g.id)
      const lows = new Map<number, number>()
      const highs = new Map<number, number>()
      for (const layer of layersOf.get(g.id) ?? []) {
        const own = direct.get(g.id)?.get(layer) ?? []
        const inner = (childrenOf.get(g.id) ?? []).filter((c) => leftOf(c, layer) !== undefined)
        lows.set(
          layer,
          Math.min(
            ...own.map((m) => (current[m] ?? 0) - (width[m] ?? 0) / 2),
            ...inner.map((c) => tightLeft.get(c)?.get(layer) ?? 0),
          ) - pad.left,
        )
        highs.set(
          layer,
          Math.max(
            ...own.map((m) => (current[m] ?? 0) + (width[m] ?? 0) / 2),
            ...inner.map((c) => tightRight.get(c)?.get(layer) ?? 0),
          ) + pad.right,
        )
      }
      tightLeft.set(g.id, lows)
      tightRight.set(g.id, highs)
    }
    const pulled = (tight: number | undefined, near: (number | undefined)[]) => {
      const there = near.filter((v): v is number => v !== undefined)
      return (
        ((tight ?? 0) + STRAIGHTEN * there.reduce((a, b) => a + b, 0)) /
        (1 + STRAIGHTEN * there.length)
      )
    }
    return edges.flatMap(({ group, layer }) => {
      const at = (map: Map<GroupId, Map<number, number>>, k: number) => {
        const v = frame === undefined ? undefined : map.get(group)?.get(k)
        return v === undefined ? undefined : frame?.[v - flat.length]
      }
      return [
        pulled(tightLeft.get(group)?.get(layer), [at(left, layer - 1), at(left, layer + 1)]),
        pulled(tightRight.get(group)?.get(layer), [at(right, layer - 1), at(right, layer + 1)]),
      ]
    })
  }
  const solve = (desired: readonly number[]) => solveVpsc({ desired, separations: constraints })

  let solution = solve([...x, ...edgeWants(x, undefined)])
  const anchor = 1
  const tolerance = metrics.pitch / 100
  for (let round = 0; round < 80; round++) {
    const current = solution.slice(0, flat.length)
    const frame = solution.slice(flat.length)
    const wanted = current.map((position, s) => {
      let weight = anchor
      let sum = anchor * position
      for (const [t, w] of pulls[s] ?? []) {
        weight += w
        sum += w * (current[t] ?? 0)
      }
      const slot = flat[s]
      if (slot?.kind === 'hold' && slot.group !== undefined) {
        for (const layer of [slot.layer - 1, slot.layer + 1]) {
          const l = leftOf(slot.group, layer)
          const r = rightOf(slot.group, layer)
          if (l === undefined || r === undefined) continue
          weight += THROUGH
          sum += (THROUGH * ((solution[l] ?? 0) + (solution[r] ?? 0))) / 2
        }
      }
      return sum / weight
    })
    const next = solve([...wanted, ...edgeWants(current, frame)])
    const moved = Math.max(...next.map((v, s) => Math.abs(v - (solution[s] ?? 0))))
    solution = next
    if (moved < tolerance) break
  }

  const centre = new Map(flat.map((s, i) => [s.id, solution[i] ?? 0]))

  // ---- down ----
  const layerHeight = ordered.layers.map((layer) =>
    Math.max(0, ...layer.map((s) => height[index.get(s.id) ?? 0] ?? 0)),
  )
  const span = new Map<GroupId, [number, number]>()
  for (const g of used) {
    const layers = layersOf.get(g.id) ?? []
    span.set(g.id, [layers[0] ?? 0, layers[layers.length - 1] ?? 0])
  }
  // What a frame that starts (or ends) in a layer adds: its own inset and those of the frames
  // around it that start (or end) there too; the deepest chain counts.
  const extra = (side: 'top' | 'bottom', layer: number) => {
    let most = 0
    for (const g of used) {
      let sum = 0
      for (const h of chainOf(g.id)) {
        const [first, last] = span.get(h) ?? [0, 0]
        if ((side === 'top' ? first : last) !== layer) break
        sum += inset(h)[side]
      }
      most = Math.max(most, sum)
    }
    return most
  }
  const y: number[] = []
  for (const [l, h] of layerHeight.entries()) {
    const before = y[l - 1]
    if (before === undefined) {
      y.push(extra('top', 0) + h / 2)
      continue
    }
    const gap = 2 * metrics.leadOut + metrics.pitch + extra('bottom', l - 1) + extra('top', l)
    y.push(before + (layerHeight[l - 1] ?? 0) / 2 + gap + h / 2)
  }
  const bands = layerHeight.map((h, l) => ({
    top: (y[l] ?? 0) - h / 2,
    bottom: (y[l] ?? 0) + h / 2,
  }))

  const frames = new Map<GroupId, Frame>()
  const top = new Map<GroupId, number>()
  const bottom = new Map<GroupId, number>()
  for (const g of deepestFirst) {
    const own = (members.get(g.id) ?? []).filter((m) => flat[m]?.group === g.id && real[m])
    const pad = inset(g.id)
    const tops = [
      ...own.map((m) => (y[flat[m]?.layer ?? 0] ?? 0) - (height[m] ?? 0) / 2),
      ...used.filter((c) => c.parent === g.id).map((c) => top.get(c.id) ?? 0),
    ]
    const bottoms = [
      ...own.map((m) => (y[flat[m]?.layer ?? 0] ?? 0) + (height[m] ?? 0) / 2),
      ...used.filter((c) => c.parent === g.id).map((c) => bottom.get(c.id) ?? 0),
    ]
    const t = Math.min(...tops) - pad.top
    const b = Math.max(...bottoms) + pad.bottom
    top.set(g.id, t)
    bottom.set(g.id, b)
    // An edge that moves less than the solver's tolerance from the layer above stays where it was.
    const intervals: { left: number; right: number }[] = []
    for (const layer of layersOf.get(g.id) ?? []) {
      const l = solution[leftOf(g.id, layer) ?? 0] ?? 0
      const r = solution[rightOf(g.id, layer) ?? 0] ?? 0
      const above = intervals[intervals.length - 1]
      intervals.push({
        left: above !== undefined && Math.abs(l - above.left) < tolerance ? above.left : l,
        right: above !== undefined && Math.abs(r - above.right) < tolerance ? above.right : r,
      })
    }
    const l = Math.min(...intervals.map((i) => i.left))
    const r = Math.max(...intervals.map((i) => i.right))
    frames.set(g.id, {
      box: { x: l, y: t, width: r - l, height: b - t },
      first: span.get(g.id)?.[0] ?? 0,
      intervals,
    })
  }
  return { x: centre, y, bands, frames }
}
