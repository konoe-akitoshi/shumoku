// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Run `fn` over `items` with at most `limit` calls in flight at once,
 * preserving input order in the result array.
 *
 * Replaces the two failure modes the audit found: unbounded `Promise.all`
 * fan-out (network-scan would open hundreds of SNMP sockets at once) and
 * fully sequential `await`-in-a-loop polling (zabbix walked hosts one by
 * one). A rejected `fn` rejects the whole call (like `Promise.all`); a
 * caller wanting partial results should catch inside `fn`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  if (items.length === 0) return results
  const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length))
  let cursor = 0
  const run = async (): Promise<void> => {
    let i = cursor++
    while (i < items.length) {
      const item = items[i] as T
      results[i] = await fn(item, i)
      i = cursor++
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => run()))
  return results
}
