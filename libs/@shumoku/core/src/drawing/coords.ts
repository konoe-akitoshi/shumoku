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
 *
 * Down the page, a layer is as tall as its tallest element and the gap between layers is the
 * lead-outs at both ends and one line pitch.
 */
export interface Placed {
  /** The centre of each slot, across. */
  readonly x: ReadonlyMap<string, number>
  /** The centre line of each layer, down. */
  readonly y: readonly number[]
  /** The band each layer takes down the page: as tall as its tallest element. */
  readonly bands: readonly { readonly top: number; readonly bottom: number }[]
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
  const pulls: [number, number][][] = flat.map(() => [])
  for (const path of ordered.paths) {
    for (const [i, id] of path.entries()) {
      const next = path[i + 1]
      const a = index.get(id)
      const b = next === undefined ? undefined : index.get(next)
      if (a === undefined || b === undefined || flat[a]?.layer === flat[b]?.layer) continue
      const dummies = Number(!real[a]) + Number(!real[b])
      const w = dummies === 0 ? 1 : dummies === 1 ? 2 : 8
      pulls[a]?.push([b, w])
      pulls[b]?.push([a, w])
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
      for (const [t, w] of pulls[s] ?? []) {
        weight += w
        sum += w * (solution[t] ?? 0)
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
  const layerHeight = ordered.layers.map((layer) =>
    Math.max(0, ...layer.map((s) => height[index.get(s.id) ?? 0] ?? 0)),
  )
  const y: number[] = []
  for (const [l, h] of layerHeight.entries()) {
    const before = y[l - 1]
    if (before === undefined) {
      y.push(h / 2)
      continue
    }
    const gap = 2 * metrics.leadOut + metrics.pitch
    y.push(before + (layerHeight[l - 1] ?? 0) / 2 + gap + h / 2)
  }
  const bands = layerHeight.map((h, l) => ({
    top: (y[l] ?? 0) - h / 2,
    bottom: (y[l] ?? 0) + h / 2,
  }))
  return { x: centre, y, bands }
}
