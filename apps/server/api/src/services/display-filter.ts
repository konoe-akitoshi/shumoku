// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Post-resolve display filters.
 *
 * These run on the FULLY-RESOLVED graph (after `resolve()` has folded every
 * source + the project overlay) — never on a single source's contribution.
 * Degree is only defined on the merged graph: a node link-less in one source
 * may be linked by another, so a per-source evaluation would wrongly drop it.
 */

import type { NetworkGraph } from '@shumoku/core'

/**
 * Drop every node that has no incident link (degree 0).
 *
 * Flat by design: degree is the only criterion. We deliberately do NOT branch on
 * `provenance.state` (discovered-only / confirmed / intrinsic-only) — that would
 * re-introduce an "operator-placed nodes are special" authored layer, which the
 * all-sources-equal model rejects. `provenance.state` is a derived annotation
 * (how many sources saw it), not a privilege. "Hide disconnected" means hide
 * disconnected; an operator who wants to keep a standalone planned node just
 * leaves the toggle off.
 *
 * Pure: returns a new graph; never mutates the input. A degree-0 node has no
 * links by definition, so no link pruning is needed.
 */
export function filterDisconnected(graph: NetworkGraph): NetworkGraph {
  const degree = new Map<string, number>()
  for (const link of graph.links) {
    const from = link.from?.node
    const to = link.to?.node
    if (from) degree.set(from, (degree.get(from) ?? 0) + 1)
    if (to) degree.set(to, (degree.get(to) ?? 0) + 1)
  }

  const nodes = graph.nodes.filter((n) => (degree.get(n.id) ?? 0) > 0)

  if (nodes.length === graph.nodes.length) return graph
  return { ...graph, nodes }
}
