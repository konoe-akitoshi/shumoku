// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { CycleError } from './axis.js'
import type { Item } from './problem.js'

/** A place on an axis: a variable and a fixed offset from it, which is a box's own extent where the place is its far edge. */
export interface Ref {
  v: number
  off: number
  /** The box whose far edge (right or bottom) this is, when it is one: its extent is `off`. */
  farOf?: string
}

/** A separation between two places, `later` at least `gap` after `earlier`. */
export function after(earlier: Ref, later: Ref, gap: number) {
  return { i: earlier.v, j: later.v, d: gap + earlier.off - later.off, earlier, later }
}

/**
 * The layout of one axis could not keep everything asked of it together: a ring of rooms that
 * must grow without end runs through the boxes and frames named. Where the ring runs against the
 * extent of a box (in by its far edge and out by its near edge), that box made larger by what the
 * ring lacks breaks it: `grow` says by how much for each such box, the lack shared among them.
 * Where it runs against none, a room the wiring asked for is what can be given up; the structure
 * is not.
 */
export class RingError extends Error {
  constructor(
    readonly axis: 'x' | 'y',
    /** The items and frames (by key) the ring runs through. */
    readonly keys: readonly string[],
    /** The boxes whose extent, made this much larger, breaks the ring. */
    readonly grow: ReadonlyMap<string, number>,
  ) {
    super(`the ${axis} layout holds a ring of rooms through ${keys.join(', ')}`)
  }
}

/**
 * Reads a ring the solver found back into the boxes: which it runs through, and which of the
 * boxes that may grow (`growable`) it runs against, by how much.
 */
export function ringOf(
  axis: 'x' | 'y',
  e: CycleError,
  seps: readonly ReturnType<typeof after>[],
  keyOf: (v: number) => string | undefined,
  growable: (key: string) => boolean,
): RingError {
  const keys: string[] = []
  const net = new Map<string, number>()
  for (const k of e.seps) {
    const s = seps[k]
    if (!s) continue
    for (const v of [s.i, s.j]) {
      const key = keyOf(v)
      if (key !== undefined && !keys.includes(key)) keys.push(key)
    }
    // A box's extent is added to the ring where the ring leaves by its far edge, and taken away
    // where it arrives there: only a box the ring takes away from can break it by growing.
    if (s.earlier.farOf !== undefined) net.set(s.earlier.farOf, (net.get(s.earlier.farOf) ?? 0) + 1)
    if (s.later.farOf !== undefined) net.set(s.later.farOf, (net.get(s.later.farOf) ?? 0) - 1)
  }
  const against = [...net].filter(([key, n]) => n < 0 && growable(key))
  const total = against.reduce((sum, [, n]) => sum - n, 0)
  const grow = new Map(total > 0 ? against.map(([key]) => [key, e.excess / total]) : [])
  return new RingError(axis, keys, grow)
}

/** The extent along `axis` (width for x, height for y) each box the ring runs against is to have: what it has, and what the ring lacks. */
export function grownBy(
  items: readonly Item[],
  ring: RingError,
  axis: 'x' | 'y',
): Map<string, number> {
  return new Map(
    items.flatMap((i) => {
      const by = ring.grow.get(i.id)
      return by === undefined ? [] : [[i.id, (axis === 'x' ? i.size.width : i.size.height) + by]]
    }),
  )
}
