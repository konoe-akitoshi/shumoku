// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { interleave } from './global.js'
import { type Paths, passing, posOf, type Slot } from './order-paths.js'

/** A line as it passes through a cell: the places along the cell's perimeter it enters and leaves at. */
export interface Chord {
  line: string
  path: number
  /** Which cell of the route this is. */
  k: number
  cell: number
  /** The place in the order of all the chords, from which a pair is measured. */
  seq: number
  p: number
  q: number
}

/**
 * The chords of every line in every cell. Which chords there are is fixed; where each stands
 * (`p`, `q`) is written only by `countCrossings` and by the climb that places them again.
 */
export interface Chords {
  list: Chord[]
  /** The chords of each line, in the order of its cells. */
  rows: Chord[][]
  /** The chords in each cell. */
  inCell: Map<number, Chord[]>
}

export function chordsOf(g: Paths): Chords {
  const list: Chord[] = []
  const rows: Chord[][] = []
  const inCell = new Map<number, Chord[]>()
  for (const [pi, { path }] of g.lines.entries()) {
    const row: Chord[] = []
    for (const [k, cell] of path.cells.entries()) {
      const c: Chord = { line: path.line, path: pi, k, cell, seq: list.length, p: 0, q: 0 }
      list.push(c)
      row.push(c)
      inCell.set(cell, [...(inCell.get(cell) ?? []), c])
    }
    rows.push(row)
  }
  return { list, rows, inCell }
}

/** Sets where a chord stands at both its ends, from the orders and the ports as they are. */
export function place(
  g: Paths,
  ports: ReadonlyMap<string, number>,
  order: ReadonlyMap<number, string[]>,
  c: Chord,
) {
  const path = (g.lines[c.path] as (typeof g.lines)[number]).path
  const slot = (j: number) => path.slots[j] as Slot
  const ranked = (j: number) => {
    const door = slot(j).door
    return door === undefined ? undefined : order.get(door)
  }
  const pos = (j: number) => posOf(g, ports, slot(j), c.cell, ranked(j), passing(path, j))
  c.p = pos(c.k)
  c.q = pos(c.k + 1)
}

/** Two chords cross if their ends interleave, measured from the earlier chord. */
const crosses = (a: Chord, b: Chord) =>
  a.seq < b.seq ? interleave(a.p, a.q, b.p, b.q) : interleave(b.p, b.q, a.p, a.q)

interface Counted {
  total: number
  perCell: Map<number, number>
  pairs: [string, string][]
  chords: Map<number, { line: string; p: number; q: number }[]>
}

/** Places every chord from the orders and the ports, and counts the pairs that cross in each cell. */
export function countCrossings(
  g: Paths,
  ports: ReadonlyMap<string, number>,
  order: ReadonlyMap<number, string[]>,
  chords: Chords,
): Counted {
  for (const c of chords.list) place(g, ports, order, c)
  let total = 0
  const perCell = new Map<number, number>()
  const pairs: [string, string][] = []
  for (const [cell, list] of chords.inCell) {
    let n = 0
    for (const [i, a] of list.entries()) {
      for (const b of list.slice(i + 1)) {
        if (!crosses(a, b)) continue
        n++
        pairs.push([a.line, b.line])
      }
    }
    if (n > 0) perCell.set(cell, n)
    total += n
  }
  const placed = new Map(
    [...chords.inCell].map(([cell, list]) => [
      cell,
      list.map(({ line, p, q }) => ({ line, p, q })),
    ]),
  )
  return { total, perCell, pairs, chords: placed }
}

/** The crossings that these chords make with the chords in their cells, each pair once. */
export function crossingsOf(chords: Chords, set: ReadonlySet<Chord>): number {
  let n = 0
  for (const c of set) {
    for (const o of chords.inCell.get(c.cell) ?? []) {
      if (o === c || (set.has(o) && o.seq < c.seq)) continue
      if (crosses(c, o)) n++
    }
  }
  return n
}
