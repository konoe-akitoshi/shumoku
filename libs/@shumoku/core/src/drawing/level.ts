// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { ItemId, Level } from './problem.js'

/**
 * Which items stand level with each other, and how they are held there. The structure puts two
 * items level, and the heights hold their middles at one height (`flowHeights`). Levels chain: two
 * items level with a third are level with each other, so a class of items holds all its middles at
 * one height.
 *
 * A line laid straight across between two items of a class holds them level too, at the height
 * its two ports stand at. Where those ports do not lie as far from the two middles, the line and
 * the middles ask for different heights and the class has no solution. A class let go (`loose`)
 * is held by its straight lines first: its middles are joined only between items no straight line
 * already holds level, through the class's own levels, so no item of it is left free and no line
 * is asked to bend for a middle.
 */

/** A small union-find over ids. */
function unionFind() {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string): boolean => {
    const [ra, rb] = [find(a), find(b)]
    if (ra === rb) return false
    // the smaller id names the class, so the name does not depend on the order of the unions
    if (compare(ra, rb) < 0) parent.set(rb, ra)
    else parent.set(ra, rb)
    return true
  }
  return { find, union }
}

/** The class each item level with another belongs to, named by its smallest id. */
export function levelClasses(level: readonly Level[]): (item: ItemId) => string | undefined {
  const { find, union } = unionFind()
  const members = new Set<ItemId>()
  for (const { a, b } of level) {
    union(a, b)
    members.add(a)
    members.add(b)
  }
  return (item) => (members.has(item) ? find(item) : undefined)
}

/**
 * The levels the heights hold. Those of a class in `loose` are kept only where they join items that
 * no straight line (`straight`, the two items of each) already holds level, in the order given.
 */
export function heldLevels(
  level: readonly Level[],
  straight: readonly (readonly [ItemId, ItemId])[],
  loose: ReadonlySet<string>,
): Level[] {
  if (loose.size === 0) return [...level]
  const classOf = levelClasses(level)
  const isLoose = (item: ItemId) => {
    const c = classOf(item)
    return c !== undefined && loose.has(c)
  }
  const { union } = unionFind()
  for (const [a, b] of straight) if (isLoose(a) && classOf(a) === classOf(b)) union(a, b)
  return level.filter(({ a, b }) => !isLoose(a) || union(a, b))
}
