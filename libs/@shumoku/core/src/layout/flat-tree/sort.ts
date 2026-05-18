// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Sibling block ordering.
 *
 * Outer tidy-tree positions children by edge insertion order;
 * we sort them upfront so the spatial sequence (left-to-right
 * under the parent) matches the natural reading sequence of
 * the parent's source-port labels. The result: ports on the
 * parent and children appear in a monotonic sequence with no
 * zig-zags, even when port labels follow non-alphabetical
 * device conventions (`Gi1/0/1`, `Gi1/0/2`, `Te1/1/1`, ...).
 *
 * Adaptive observability: when the port-label signal is fully
 * absent — every sibling pair has identical keys or no key at
 * all — the sort still falls back to the subgraph + id
 * tiebreaker (preserving "kind-grouped" reading order: leaves
 * cluster, switches cluster). A `sibling-order` diagnostic with
 * reason `subtree-weight-fallback` flags the case so the
 * harness can identify low-signal fixtures, but the engine
 * deliberately does NOT reorder them — past experiments with a
 * centred-fan-out heuristic broke the typical "APs together
 * then switches together" expectation that network engineers
 * read from network-layout output (test: 'switch with mixed
 * downstream depths keeps leaves contiguous').
 *
 * If a future PR wants to actually exploit the no-port-signal
 * case it needs a heuristic that respects kind clustering — e.g.
 * cluster by leaf-vs-internal first, then by subtree weight
 * within each cluster.
 */

import type { Link, Node } from '../../models/types.js'
import { type Diagnostic, siblingOrderDiagnostic } from './diagnostics.js'
import type { BlockId, BlockMembers } from './types.js'

/**
 * Sort sibling blocks by the lowest source-port label on the
 * parent block leading to each child block. Tie-breakers:
 *
 *   1. **Source port label** — numeric-aware locale compare so
 *      `Gi1/0/2` sorts before `Gi1/0/10`.
 *   2. **Subgraph id** — if no parent-to-child link exists or
 *      multiple children share the same port label, keep
 *      same-subgraph children clustered.
 *   3. **Block id** — final deterministic tiebreaker.
 */
export function sortBlocksBySourcePort(
  blockIds: readonly BlockId[],
  parentBlockId: BlockId,
  blockMembers: BlockMembers,
  links: readonly Link[],
  nodesById: Map<string, Node>,
  shouldFlip: (link: Link) => boolean,
  diagnostics?: Diagnostic[],
): BlockId[] {
  const parentMembers = new Set(blockMembers.get(parentBlockId) ?? [])
  const portLabelOf = (nodeId: string, portId: string): string => {
    const port = nodesById.get(nodeId)?.ports?.find((p) => p.id === portId)
    return port?.label ?? portId
  }
  const keyOf = (block: BlockId): string | null => {
    const members = new Set(blockMembers.get(block) ?? [])
    let best: string | null = null
    for (const link of links) {
      if (link.redundancy) continue
      const flip = shouldFlip(link)
      const from = flip ? link.to : link.from
      const to = flip ? link.from : link.to
      if (!parentMembers.has(from.node) || !members.has(to.node)) continue
      const label = portLabelOf(from.node, from.port)
      if (best === null || label.localeCompare(best, undefined, { numeric: true }) < 0) {
        best = label
      }
    }
    return best
  }
  const subgraphOf = (block: BlockId): string => {
    const primary = blockMembers.get(block)?.[0] ?? block
    return nodesById.get(primary)?.parent ?? ''
  }

  // Single pass: try the port-label sort. Track whether any
  // pair was decided by port labels; when none was, mark the
  // sort as having fallen back so the diagnostic captures it.
  let portLabelDecided = false
  const ordered = [...blockIds].sort((a, b) => {
    const ka = keyOf(a)
    const kb = keyOf(b)
    if (ka === null && kb === null) {
      // both unlinked
    } else if (ka === null) {
      return 1
    } else if (kb === null) {
      return -1
    } else {
      const portCmp = ka.localeCompare(kb, undefined, { numeric: true })
      if (portCmp !== 0) {
        portLabelDecided = true
        return portCmp
      }
    }
    const sgCmp = subgraphOf(a).localeCompare(subgraphOf(b))
    if (sgCmp !== 0) return sgCmp
    return a.localeCompare(b)
  })

  if (diagnostics && ordered.length > 1) {
    diagnostics.push(
      siblingOrderDiagnostic(
        parentBlockId,
        portLabelDecided ? 'source-port-label' : 'port-label-absent-fallback',
        ordered,
      ),
    )
  }
  return ordered
}
