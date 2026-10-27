// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { ElementId, Elements } from './elements.js'
import type { Metrics, Size } from './metrics.js'
import type { Ordered } from './order.js'

/**
 * Layer 3b, between the order and the coordinates of one level. A layer can hold dozens of
 * blocks side by side (every site under the boundary, a row of redundancy pairs), and the level
 * is then as wide as that one row however tall the rest is.
 *
 * Splitting a layer into consecutive rows is safe because of what a layer is: the elements of
 * one layer have no directed line between them (a directed line always runs from a nearer layer
 * to a farther one), so nothing a row is put under or over can break a direction. The runs
 * keep their left-to-right order, so the order found for the layer is still the order of its
 * rows, and a line between layers is merely a layer longer where it passes the rows between.
 *
 * The level stops being wrapped where the target shape is reached: the widest layer is given
 * one more row while that brings width over height closer to `metrics.aspect` (compared as
 * ratios, so too wide and too tall weigh the same), and not once it would not. A level already
 * within the target is therefore left as it is. The rows of a layer are cut so that the widest
 * run is as narrow as it can be, and among those the runs are as even as they can be.
 *
 * The shape that is compared is the one the level really comes out as, not an estimate from
 * the layers' heights: the heights a level's layers sum to are taller than what compaction
 * down the page gives (a short block does not wait for a tall one beside it), so an estimate
 * stops a level wider than the target. The caller therefore passes `place`, which orders and
 * places the level for a candidate and returns the size that comes out, so that this file
 * decides and does not know how the level is placed.
 */
export interface Wrapped {
  /** The new rank of every element: the old layers in order, each as many ranks as it has rows. */
  readonly rank: ReadonlyMap<ElementId, number>
  /** Every element in the order the rows keep, layer by layer, for the order to start from. */
  readonly seed: readonly ElementId[]
}

/**
 * The size the level comes out as when it is placed with the rows of `wrapped`, or, with none,
 * as the order it was given stands.
 */
export type Place = (wrapped?: Wrapped) => Size

interface Item {
  readonly id: ElementId
  readonly width: number
  readonly height: number
}

/** The widths of consecutive runs of `items` cut into `rows`: the widest run least, then even. */
export function cutRows(items: readonly Item[], rows: number, gap: number): Item[][] {
  const n = items.length
  const k = Math.max(1, Math.min(rows, n))
  const span = (from: number, to: number) => {
    let sum = gap * Math.max(0, to - from - 1)
    for (const item of items.slice(from, to)) sum += item.width
    return sum
  }
  // best[j][i]: the first i items in j runs, as [widest run, sum of squares of the runs].
  type Cost = readonly [number, number]
  const better = (a: Cost, b: Cost) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1])
  const best: (Cost | undefined)[][] = Array.from({ length: k + 1 }, () => Array(n + 1))
  const cut: number[][] = Array.from({ length: k + 1 }, () => Array(n + 1).fill(0))
  const first = best[0]
  if (first) first[0] = [0, 0]
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= n; i++) {
      for (let from = j - 1; from < i; from++) {
        const before = best[j - 1]?.[from]
        if (!before) continue
        const w = span(from, i)
        const cost: Cost = [Math.max(before[0], w), before[1] + w * w]
        const now = best[j]?.[i]
        if (!now || better(cost, now)) {
          const row = best[j]
          if (row) row[i] = cost
          const cuts = cut[j]
          if (cuts) cuts[i] = from
        }
      }
    }
  }
  const runs: Item[][] = []
  let end = n
  for (let j = k; j >= 1; j--) {
    const from = cut[j]?.[end] ?? 0
    runs.unshift(items.slice(from, end))
    end = from
  }
  return runs
}

/**
 * The ranks that give the layers of `ordered` the rows that bring the level's shape to
 * `metrics.aspect`, or nothing when the level is already as near the target as it can be made.
 */
export function wrapLayers(
  elements: Elements,
  ordered: Ordered,
  metrics: Metrics,
  place: Place,
): Wrapped | undefined {
  const sizes = new Map(elements.elements.map((e) => [e.id, e.size]))
  const ports = new Set(elements.elements.filter((e) => e.kind === 'port').map((e) => e.id))
  const layers: Item[][] = ordered.layers.map((layer) =>
    layer.flatMap((s) => {
      const size = s.kind === 'element' ? sizes.get(s.id) : undefined
      return size === undefined ? [] : [{ id: s.id, width: size.width, height: size.height }]
    }),
  )
  // A layer of ports is where lines cross a frame's edge; it is not a row of anything to split.
  const fixed = layers.map((layer) => layer.some((m) => ports.has(m.id)))
  const runsOf = (rows: readonly number[]) =>
    layers.map((items, i) => cutRows(items, rows[i] ?? 1, metrics.gap))
  const off = (shape: Size) =>
    shape.width > 0 && shape.height > 0
      ? Math.abs(Math.log(shape.width / shape.height) - Math.log(metrics.aspect))
      : Number.POSITIVE_INFINITY

  const rows = layers.map(() => 1)
  let runs = runsOf(rows)
  let distance = off(place())
  let wrapped: Wrapped | undefined
  for (;;) {
    // The layer with the widest run; a layer already one element to a row cannot be split more.
    let widest = -1
    let widestWidth = -1
    for (const [i, layer] of runs.entries()) {
      const w = Math.max(0, ...layer.map((run) => widthOf(run, metrics.gap)))
      if (fixed[i] !== true && (layers[i]?.length ?? 0) > (rows[i] ?? 1) && w > widestWidth) {
        widest = i
        widestWidth = w
      }
    }
    if (widest < 0) break
    const trial = rows.map((r, i) => (i === widest ? r + 1 : r))
    const trialRuns = runs.map((layer, i) =>
      i === widest ? cutRows(layers[i] ?? [], trial[i] ?? 1, metrics.gap) : layer,
    )
    const trialWrapped = wrappedOf(trialRuns)
    const next = off(place(trialWrapped))
    if (!(next < distance)) break
    rows[widest] = trial[widest] ?? 1
    runs = trialRuns
    distance = next
    wrapped = trialWrapped
  }
  return wrapped
}

/** The ranks and the order of runs of layers: each run a rank of its own, layers in order. */
const wrappedOf = (runs: readonly (readonly Item[][])[]): Wrapped => {
  const rank = new Map<ElementId, number>()
  const seed: ElementId[] = []
  let next = 0
  for (const layer of runs) {
    for (const run of layer) {
      for (const item of run) {
        rank.set(item.id, next)
        seed.push(item.id)
      }
      next++
    }
  }
  return { rank, seed }
}

const widthOf = (run: readonly Item[], gap: number) =>
  run.reduce((sum, m) => sum + m.width, 0) + gap * Math.max(0, run.length - 1)
