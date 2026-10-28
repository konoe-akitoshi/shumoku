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
 * does not reach at all (without it the element would have nothing to stand by). A VPN, a
 * backup, a zone transfer, a tunnel or a management line between two elements the structure
 * does reach, but that the structure does not count as nearness, is laid over the network: it
 * pulls nothing and is not given a path through the layers, so it cannot turn the picture of
 * the network into the picture of itself.
 *
 * Whether a line places and whether it carries a direction are two things, and the structure
 * alone gives the second: a line is directed (one end nearer, one farther) when its pair is in
 * some plane's `flows`, or when it is a layout line that holds a hosted element under its host.
 * Every other line that places, a pair listed only in `even` or a line to an element the
 * structure does not reach, pulls its ends together in x but never says which stands above.
 *
 * Which end of a directed line is the nearer is given by the pair itself, the first end of the
 * `flows` pair or the host of a layout line, and not by comparing any number between the ends.
 * A pair that two planes list in opposite ways takes the way of the plane written first.
 *
 * Which end stands above follows from the side. The boundary is where the network's cables end:
 * what the physical side reaches from it is the network itself, which hangs below it, and what
 * the virtual side reaches is beyond it (the clouds, the providers, the networks the virtual
 * lines go to), which stands above it as what the network comes from. So the upper end is the
 * nearer one on the physical side, the farther one on the virtual side, and the host of a
 * layout line.
 */
export interface Placing {
  /** The elements with only the lines that place, numbered again from 0. */
  readonly elements: Elements
  /** For each line of the original elements, its index in `elements`; none for a laid-over line. */
  readonly lineOf: readonly (number | undefined)[]
  /**
   * For each line of the original elements that places, the index (0 or 1, in `ends`) of the
   * end that stands above when the structure gives it a direction; none for a line without one.
   */
  readonly upper: readonly (0 | 1 | undefined)[]
}

const pairKey = (a: ElementId, b: ElementId) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

export function placingLines(elements: Elements, structure: Structure): Placing {
  const near = new Set<string>()
  /** For each pair in `flows`, the element that stands above: see the side, above. */
  const flowing = new Map<string, ElementId>()
  const reached = new Set<ElementId>(structure.boundary.map(elementIdOf))
  for (const plane of structure.planes) {
    for (const [a, b] of plane.flows) {
      const key = pairKey(elementIdOf(a), elementIdOf(b))
      if (!flowing.has(key)) flowing.set(key, elementIdOf(plane.side === 'virtual' ? b : a))
    }
    for (const [a, b] of [...plane.flows, ...plane.even]) {
      const [x, y] = [elementIdOf(a), elementIdOf(b)]
      near.add(pairKey(x, y))
      reached.add(x)
      reached.add(y)
    }
  }
  const lines: Elements['lines'][number][] = []
  const lineOf: (number | undefined)[] = []
  const upperEnd: (0 | 1 | undefined)[] = []
  for (const line of elements.lines) {
    const [a, b] = line.ends
    const places =
      line.layoutOnly === true ||
      near.has(pairKey(a.element, b.element)) ||
      !reached.has(a.element) ||
      !reached.has(b.element)
    const above = flowing.get(pairKey(a.element, b.element))
    if (!places) upperEnd.push(undefined)
    else if (line.layoutOnly === true) upperEnd.push(0)
    else upperEnd.push(above === a.element ? 0 : above === b.element ? 1 : undefined)
    if (!places) {
      lineOf.push(undefined)
      continue
    }
    lineOf.push(lines.length)
    lines.push({ ...line, index: lines.length })
  }
  return { elements: { ...elements, lines }, lineOf, upper: upperEnd }
}
