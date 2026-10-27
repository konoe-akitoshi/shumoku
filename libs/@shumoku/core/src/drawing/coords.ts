// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Elements } from './elements.js'
import type { Metrics } from './metrics.js'
import type { Ordered } from './order.js'
import { type Separation, solveVpsc } from './vpsc.js'

/**
 * Layer 4. Coordinates for the ordered slots of one level (see `compound.ts`: a group's
 * contents, or the drawing's top level).
 *
 * Across a layer, the sum of the squares of how far each line runs sideways is made least, with
 * the spacing as separation constraints that VPSC meets exactly: neighbours in a layer keep
 * their half widths and a gap apart. The objective is solved by repeating: every slot wants the
 * weighted mean of the slots it is joined to (a line between two real elements weighs 1, one
 * with a dummy end 2, between two dummies 8, so that long lines run straight), VPSC finds the
 * nearest positions that keep the constraints, and the next round starts from there.
 * A line that ends off the centre of an element (a block's line ends at what is inside it) pulls
 * toward that point, and not toward the centre.
 *
 * Down the page, the slots are compacted: the layers keep their order (a slot of a later layer
 * is never above one of an earlier layer that it is joined to, or that stands where it does
 * across), but a layer is not a band. Each slot goes as high as the constraints allow, the
 * longest path in a graph of "must come after" (the compaction step of Tamassia's
 * orthogonal-layout method). A slot must start below the bottom of
 *  - a slot of the layer before it that a line runs to it from (the paths, dummies included),
 *  - and any slot of an earlier layer whose span across, widened by the spacing kept between
 *    the two, overlaps its own,
 * with a gap of the lead-outs at both ends and one line pitch. So a short block does not leave
 * blank space under it just because a tall one shares its layer, and what stands beside the tall
 * one, out of its way across, can start higher. Dummies and ports are points without height and
 * obey the same constraints.
 */
export interface Placed {
  /** The centre of each slot, across. */
  readonly x: ReadonlyMap<string, number>
  /** The centre of each slot, down. Slots of one layer need not share a line. */
  readonly y: ReadonlyMap<string, number>
}

export function placeCoords(elements: Elements, ordered: Ordered, metrics: Metrics): Placed {
  const sizes = new Map(elements.elements.map((e) => [e.id, e.size]))
  const flat = ordered.layers.flat()
  const index = new Map(flat.map((s, i) => [s.id, i]))
  const width = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.width ?? 0) : 0))
  const height = flat.map((s) => (s.kind === 'element' ? (sizes.get(s.id)?.height ?? 0) : 0))
  const real = flat.map((s) => s.kind === 'element')

  // ---- constraints: neighbours in a layer keep apart ----
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
  const constraints: Separation[] = []
  for (const layer of ordered.layers) {
    for (const [i, s] of layer.entries()) {
      const next = layer[i + 1]
      const a = index.get(s.id)
      const b = next === undefined ? undefined : index.get(next.id)
      if (a !== undefined && b !== undefined) {
        constraints.push({ left: a, right: b, gap: apart(a, b) })
      }
    }
  }

  // ---- across ----
  // The lines between adjacent layers, with how much each is worth keeping straight.
  // A line may end off the centre of an element (`LineEnd.offset`); a slot then wants to stand
  // so that the two points the line joins are at one place across, the port-offset form of the
  // least-squares objective: x_s + off_s = x_t + off_t, so s wants x_t + off_t - off_s.
  const pulls: [number, number, number][][] = flat.map(() => [])
  for (const [line, path] of ordered.paths.entries()) {
    const ends = elements.lines[line]?.ends
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      const a = index.get(id)
      const b = next === undefined ? undefined : index.get(next)
      if (a === undefined || b === undefined || flat[a]?.layer === flat[b]?.layer) continue
      const dummies = Number(!real[a]) + Number(!real[b])
      const w = dummies === 0 ? 1 : dummies === 1 ? 2 : 8
      const from = i === 0 ? (ends?.[0].offset ?? 0) : 0
      const to = i + 2 === path.length ? (ends?.[1].offset ?? 0) : 0
      pulls[a]?.push([b, w, to - from])
      pulls[b]?.push([a, w, from - to])
    }
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

  const solve = (desired: readonly number[]) => solveVpsc({ desired, separations: constraints })
  let solution = solve(x)
  const anchor = 1
  const tolerance = metrics.pitch / 100
  for (let round = 0; round < 80; round++) {
    const wanted = solution.map((position, s) => {
      let weight = anchor
      let sum = anchor * position
      for (const [t, w, shift] of pulls[s] ?? []) {
        weight += w
        sum += w * ((solution[t] ?? 0) + shift)
      }
      return sum / weight
    })
    const next = solve(wanted)
    const moved = Math.max(...next.map((v, s) => Math.abs(v - (solution[s] ?? 0))))
    solution = next
    if (moved < tolerance) break
  }
  const centre = new Map(flat.map((s, i) => [s.id, solution[i] ?? 0]))

  // ---- down ----
  // Every constraint runs from an earlier layer to a later one, so taking the slots in layer
  // order is a topological order of the graph and one pass finds each slot's longest path.
  const gap = 2 * metrics.leadOut + metrics.pitch
  const layerOf = flat.map((s) => s.layer)
  const before: number[][] = flat.map(() => [])
  for (const path of ordered.paths) {
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      const a = index.get(id)
      const b = next === undefined ? undefined : index.get(next)
      if (a === undefined || b === undefined || layerOf[a] === layerOf[b]) continue
      const [upper, lower] = (layerOf[a] ?? 0) < (layerOf[b] ?? 0) ? [a, b] : [b, a]
      before[lower]?.push(upper)
    }
  }
  for (const a of flat.keys()) {
    for (const b of flat.keys()) {
      if ((layerOf[b] ?? 0) <= (layerOf[a] ?? 0)) continue
      if (Math.abs((solution[a] ?? 0) - (solution[b] ?? 0)) < apart(a, b) - tolerance) {
        before[b]?.push(a)
      }
    }
  }
  const top: number[] = []
  const order = flat.map((_, i) => i).sort((a, b) => (layerOf[a] ?? 0) - (layerOf[b] ?? 0) || a - b)
  for (const s of order) {
    let at = 0
    for (const earlier of before[s] ?? []) {
      at = Math.max(at, (top[earlier] ?? 0) + (height[earlier] ?? 0) + gap)
    }
    top[s] = at
  }
  const y = new Map(flat.map((s, i) => [s.id, (top[i] ?? 0) + (height[i] ?? 0) / 2]))
  return { x: centre, y }
}
