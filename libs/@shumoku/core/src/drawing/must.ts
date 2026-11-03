// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Reads that cannot miss. A stage that looks up what an earlier stage made, by a key that stage
 * made, has no value to fall back on: a default (the first unknown, an empty list) draws a
 * plausible picture from a wrong key, so a miss stops the drawing and names the key instead.
 */

/** The value a map holds for a key that must be there. */
export function must<K, V>(map: ReadonlyMap<K, V>, key: K, what: string): V {
  const found = map.get(key)
  if (found === undefined) throw new Error(`${what}: no ${String(key)}`)
  return found
}

/** Where a branch cannot be reached; for exhaustive checks on a union. */
export function assertNever(value: never, what: string): never {
  throw new Error(`${what}: unexpected ${JSON.stringify(value)}`)
}
