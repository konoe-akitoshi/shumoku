// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { End } from './stage-types.js'

/** Plain code-unit order, the same on every machine and in every locale. */
export function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function sorted(items: Iterable<string>): string[] {
  return [...items].sort(compare)
}

/** A set of members named by its members; `\0` cannot be part of a written id. */
export function setKey(members: readonly string[]): string {
  return joinKey(sorted(members))
}

/** One key from several parts: the one place the separator is written. */
export function joinKey(parts: readonly (string | number)[]): string {
  return parts.join('\0')
}

/** The parts a key was joined from. */
export function splitKey(key: string): string[] {
  return key.split('\0')
}

export function endKey(end: End): string {
  if ('segment' in end) return `s:${end.segment}`
  if ('routingDomain' in end) return `r:${end.routingDomain}`
  return end.port === undefined ? `n:${end.node}` : `n:${end.node}\0${end.port}`
}

/** The two ends in a fixed order. */
export function orderEnds(a: End, b: End): readonly [End, End] {
  return compare(endKey(a), endKey(b)) <= 0 ? [a, b] : [b, a]
}

/** Whether two sets (as sorted arrays) cross: they overlap and neither holds the other. */
export function crosses(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  let both = 0
  for (const x of a) if (b.has(x)) both++
  return both > 0 && both < a.size && both < b.size
}
