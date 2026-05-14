// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Replace the contents of a Map in place, preserving its identity
 * so bindings and downstream reactivity stay attached.
 *
 * Diff-apply, NOT clear-then-set: the naive impl flashes the map
 * to `size === 0` between clear() and the first set(), which trips
 * any reactive consumer gated on `size > 0` (e.g. the diagram
 * page's `{#if nodes.size > 0}` mount, action enabled predicates,
 * derived counts). Those observers see the empty state and tear
 * down — instance state on whatever just unmounted (the
 * renderer's selection set is the canonical victim) goes with it.
 *
 * Diffing keeps `size` monotonic relative to the real change set,
 * and Map.set on an existing key preserves insertion order, so
 * keyed `{#each}` blocks stay aligned without DOM churn beyond
 * the entries that actually moved.
 *
 * Pure module on purpose: separated from `diagram.svelte.ts` so
 * it can be imported from vitest tests without dragging the Svelte
 * runes runtime in.
 */
export function replaceMap<K, V>(target: Map<K, V>, source: Iterable<[K, V]>) {
  const next = source instanceof Map ? source : new Map(source)
  // Delete first, then upsert. Order matters: deleting `next`
  // members before re-setting them would still cause a flash.
  for (const k of [...target.keys()]) {
    if (!next.has(k)) target.delete(k)
  }
  for (const [k, v] of next) target.set(k, v)
}
