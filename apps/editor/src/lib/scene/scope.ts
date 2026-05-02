// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Node, Subgraph } from '@shumoku/core'

/**
 * A subgraph is "physical" when it represents something that occupies
 * physical space on a floor plan (a building, rack, room). Logical
 * subgraphs (cloud services, virtual networks) have no physical
 * realization, so they can't host a scene.
 *
 * Heuristic: explicit `kind` if present, else fall back to spec —
 * hardware (or unspecified) is physical; compute / service is logical.
 * Most user-authored subgraphs have no spec, so they're physical by
 * default — matching the common case (a "Building A" group).
 */
export function isPhysicalSubgraph(sg: Subgraph): boolean {
  const k = (sg as Subgraph & { kind?: 'physical' | 'logical' }).kind
  if (k) return k === 'physical'
  if (!sg.spec) return true
  return sg.spec.kind === 'hardware'
}

/**
 * IDs of `subgraphId` plus every descendant subgraph (transitive
 * closure via `parent` / `children`).
 */
export function descendantSubgraphIds(
  subgraphs: Map<string, Subgraph> | Iterable<Subgraph>,
  subgraphId: string,
): Set<string> {
  const map =
    subgraphs instanceof Map ? subgraphs : new Map([...subgraphs].map((sg) => [sg.id, sg] as const))
  const out = new Set<string>([subgraphId])
  const queue = [subgraphId]
  while (queue.length > 0) {
    const id = queue.shift() as string
    const sg = map.get(id)
    if (!sg) continue
    if (sg.children) {
      for (const childId of sg.children) {
        if (!out.has(childId)) {
          out.add(childId)
          queue.push(childId)
        }
      }
    }
    // Defensive: also traverse via `parent` back-pointer for entries
    // missing children arrays.
    for (const other of map.values()) {
      if (other.parent === id && !out.has(other.id)) {
        out.add(other.id)
        queue.push(other.id)
      }
    }
  }
  return out
}

/**
 * Filter nodes to the descendants of `scopeSubgraphId`. `undefined`
 * scope returns every node (root scene = whole graph).
 */
export function nodesInScope(
  nodes: Iterable<Node>,
  subgraphs: Map<string, Subgraph> | Iterable<Subgraph>,
  scopeSubgraphId: string | undefined,
): Node[] {
  if (!scopeSubgraphId) return [...nodes]
  const allowed = descendantSubgraphIds(subgraphs, scopeSubgraphId)
  return [...nodes].filter((n) => n.parent !== undefined && allowed.has(n.parent))
}
