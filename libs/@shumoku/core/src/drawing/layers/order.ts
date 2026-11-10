// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Of the ids in `sequence` that `hint` names, those already standing in the hint's order: the
 * longest such run, the earliest when there are several. What is not returned is what has to
 * move for the hint to hold. Ids the hint does not name are passed over.
 */
export function inHintOrder(
  sequence: readonly string[],
  hint: readonly string[],
): ReadonlySet<string> {
  const wanted = new Map(hint.map((id, i) => [id, i] as const))
  const named = sequence.filter((id) => wanted.has(id))
  const rankOf = (id: string) => wanted.get(id) ?? -1
  const len: number[] = []
  const prev: number[] = []
  for (const [i, id] of named.entries()) {
    len[i] = 1
    prev[i] = -1
    for (const [j, before] of named.slice(0, i).entries()) {
      if (rankOf(before) < rankOf(id) && (len[j] ?? 0) + 1 > (len[i] ?? 0)) {
        len[i] = (len[j] ?? 0) + 1
        prev[i] = j
      }
    }
  }
  let end = 0
  for (const [i, l] of len.entries()) if (l > (len[end] ?? 0)) end = i
  const kept = new Set<string>()
  for (let i = named.length > 0 ? end : -1; i >= 0; i = prev[i] ?? -1) {
    const id = named[i]
    if (id !== undefined) kept.add(id)
  }
  return kept
}
