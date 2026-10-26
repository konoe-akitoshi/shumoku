// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Structure } from '../structure/types.js'
import { type ElementId, type Elements, elementIdOf } from './elements.js'

/**
 * The lines that place. The order and the coordinates are fed these and no others; the rest are
 * only drawn.
 *
 * A line places when its two ends are a pair the structure keeps in its nearness (a pair listed
 * in some plane's `flows` or `even`, matched by the elements at its ends), when it is a layout
 * line that holds a hosted element under its host, or when an end is an element the structure
 * does not reach at all (the drawing's own rule ranked it by that line, and without it the
 * element would have nothing to stand by). A VPN, a backup, a zone transfer, a tunnel or a
 * management line between two elements the structure does reach, but that the structure does
 * not count as nearness, is laid over the network: it pulls nothing and is not given a path
 * through the ranks, so it cannot turn the picture of the network into the picture of itself.
 */
export interface Placing {
  /** The elements with only the lines that place, numbered again from 0. */
  readonly elements: Elements
  /** For each line of the original elements, its index in `elements`; none for a laid-over line. */
  readonly lineOf: readonly (number | undefined)[]
}

const pairKey = (a: ElementId, b: ElementId) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

export function placingLines(elements: Elements, structure: Structure): Placing {
  const near = new Set<string>()
  const reached = new Set<ElementId>(structure.boundary.map(elementIdOf))
  for (const plane of structure.planes) {
    for (const [a, b] of [...plane.flows, ...plane.even]) {
      const [x, y] = [elementIdOf(a), elementIdOf(b)]
      near.add(pairKey(x, y))
      reached.add(x)
      reached.add(y)
    }
  }
  const lines: Elements['lines'][number][] = []
  const lineOf: (number | undefined)[] = []
  for (const line of elements.lines) {
    const [a, b] = line.ends
    const places =
      line.layoutOnly === true ||
      near.has(pairKey(a.element, b.element)) ||
      !reached.has(a.element) ||
      !reached.has(b.element)
    if (!places) {
      lineOf.push(undefined)
      continue
    }
    lineOf.push(lines.length)
    lines.push({ ...line, index: lines.length })
  }
  return { elements: { ...elements, lines }, lineOf }
}
