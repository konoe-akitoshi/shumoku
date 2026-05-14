// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Unified lookup for ids that appear in `Link.via`. A via id used to
 * be guaranteed to be a `Node.id` (when terminations lived in
 * `diagram.nodes`), so consumers walked `Map<string, Node>` directly.
 * Now EPS / Outlet / Panel terminations live in a separate registry,
 * so we wrap the two stores behind one lookup helper.
 *
 * The shadow Map this builds carries fake `Node`-shaped entries for
 * terminations so existing call sites that look at `node.termination?.role`
 * and `node.position` keep working without per-consumer plumbing.
 * That's a compromise — the type lies a bit — but it concentrates
 * the cost to this single helper. Callers that want the *real*
 * termination shape can iterate the registry directly.
 */

import type { Node, Termination } from '@shumoku/core'

/**
 * Merge a Node map and a Termination array into a single lookup keyed
 * by id. Termination entries are surfaced as Node-shaped shadows so
 * `entry.termination?.role` and `entry.position` resolve uniformly
 * across both real nodes and registry entries.
 */
export function viaLookup(
  nodes: Map<string, Node>,
  terminations: readonly Termination[],
): Map<string, Node> {
  const merged = new Map<string, Node>(nodes)
  for (const t of terminations) {
    merged.set(t.id, {
      id: t.id,
      label: t.label,
      termination: { role: t.role },
      position: t.position,
    } as Node)
  }
  return merged
}
