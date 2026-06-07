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
 * Drop nodes that have no incident link (degree 0), EXCEPT operator-placed
 * (intrinsic) nodes — an orphan the human put there on purpose stays. Only
 * auto-discovered orphans (`provenance.state === 'discovered-only'`) are hidden.
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

  const nodes = graph.nodes.filter((n) => {
    if ((degree.get(n.id) ?? 0) > 0) return true
    // Degree 0: keep only if the operator engaged with it. A purely
    // auto-discovered orphan is dropped; anything the human placed/touched
    // (intrinsic-only / confirmed) stays.
    return n.provenance?.state !== 'discovered-only'
  })

  if (nodes.length === graph.nodes.length) return graph
  return { ...graph, nodes }
}
