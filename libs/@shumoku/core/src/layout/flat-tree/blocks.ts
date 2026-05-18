// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Block partitioning.
 *
 * The outer tidy-tree doesn't operate on raw nodes — it
 * operates on **blocks**, opaque groups of nodes the engine
 * treats as a single layout unit. Block formation rules:
 *
 *   - **Top-level nodes** (no `parent` subgraph) form their
 *     own single-member blocks.
 *
 *   - **Subgraph with ≤1 emitter** collapses to one block
 *     containing all subgraph members. An *emitter* is a
 *     subgraph member with at least one tree-child outside the
 *     subgraph (the typical "access switch with a downlink to
 *     a core router below"). One-emitter subgraphs are the
 *     overwhelmingly common case (e.g. HALL with switches +
 *     APs, where only one switch faces up to the upstream
 *     router).
 *
 *   - **Subgraph with N > 1 emitters** splits into N blocks,
 *     one per emitter, plus blocks for any non-emitter chain
 *     roots inside the subgraph (those rooted at a non-emitter
 *     member with no non-emitter tree-parent in the same
 *     subgraph). Each non-emitter member joins the block of
 *     its nearest tree-parent emitter, walking up through
 *     non-emitter ancestors. Multi-emitter splits let the
 *     outer tidy-tree place each emitter's external children at
 *     its own depth — e.g. New Group with eps-sw01 → eps-sw02
 *     becomes two blocks {eps-sw01} and {eps-sw02}, and the
 *     downstream HALL/FOYER/RECEPTION (rooted at eps-sw01) sits
 *     above LOBBY/ROOM2/etc (rooted at eps-sw02).
 *
 * Invariant: every node belongs to exactly one block; every
 * block has ≥1 member.
 */

import type { NetworkGraph } from '../../models/types.js'
import { blockJoinDiagnostic, type Diagnostic } from './diagnostics.js'
import type { BlockMembers, BlockOfNode } from './types.js'

export interface BlockPartition {
  blockOfNode: BlockOfNode
  blockMembers: BlockMembers
}

/**
 * Partition the graph's nodes into blocks. See file-level
 * comment for the rules.
 *
 * Parameters:
 *   - `graph` — source `NetworkGraph` (members read from
 *     `graph.nodes`, subgraph membership from `node.parent`).
 *   - `parents` — primary-parent map from {@link
 *     ./parents.ts | buildPrimaryParents}.
 */
export function buildBlocks(
  graph: NetworkGraph,
  parents: Map<string, string>,
  diagnostics?: Diagnostic[],
): BlockPartition {
  const subgraphMembers = groupBySubgraph(graph)
  const isEmitter = findEmitters(subgraphMembers, parents)

  const blockOfNode: BlockOfNode = new Map()
  const blockMembers: BlockMembers = new Map()

  // Top-level nodes (no parent subgraph) are single-member blocks.
  for (const n of graph.nodes) {
    if (!n.parent) {
      blockOfNode.set(n.id, n.id)
      blockMembers.set(n.id, [n.id])
      diagnostics?.push(blockJoinDiagnostic(n.id, n.id, 'top-level-singleton'))
    }
  }

  for (const [sg, members] of subgraphMembers) {
    const emitters = members.filter((m) => isEmitter.has(m))
    if (emitters.length <= 1) {
      // Collapse: one block holds the whole subgraph.
      const blockId = sg
      for (const m of members) {
        blockOfNode.set(m, blockId)
        diagnostics?.push(blockJoinDiagnostic(m, blockId, 'single-emitter-subgraph'))
      }
      blockMembers.set(blockId, [...members])
    } else {
      // Split: each emitter becomes its own block.
      for (const e of emitters) {
        blockOfNode.set(e, e)
        blockMembers.set(e, [e])
        diagnostics?.push(blockJoinDiagnostic(e, e, 'emitter-of-multi-emitter-subgraph'))
      }
      // Non-emitter members join the block of their nearest
      // tree-parent emitter inside the same subgraph. If none
      // exists (member is detached from any in-subgraph
      // emitter), the member starts a fresh solo block.
      const memberSet = new Set(members)
      for (const m of members) {
        if (isEmitter.has(m)) continue
        let cur: string | undefined = parents.get(m)
        while (cur !== undefined && memberSet.has(cur) && !isEmitter.has(cur)) {
          cur = parents.get(cur)
        }
        if (cur !== undefined && memberSet.has(cur) && isEmitter.has(cur)) {
          blockOfNode.set(m, cur)
          blockMembers.get(cur)?.push(m)
          diagnostics?.push(blockJoinDiagnostic(m, cur, 'non-emitter-joined-nearest-emitter'))
        } else {
          blockOfNode.set(m, m)
          blockMembers.set(m, [m])
          diagnostics?.push(blockJoinDiagnostic(m, m, 'top-level-singleton'))
        }
      }
    }
  }

  return { blockOfNode, blockMembers }
}

/**
 * Bucket every subgraph-attached node by its parent subgraph
 * id. Top-level nodes are not included (they form their own
 * trivial blocks at the call site).
 */
function groupBySubgraph(graph: NetworkGraph): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!n.parent) continue
    const list = out.get(n.parent) ?? []
    list.push(n.id)
    out.set(n.parent, list)
  }
  return out
}

/**
 * Set of node ids that are *emitters* — members of some
 * subgraph that have at least one tree-child outside that
 * subgraph. The definition is per-node, not per-subgraph: a
 * single node is an emitter if and only if it emits at least
 * one downward edge that crosses its own subgraph boundary.
 */
function findEmitters(
  subgraphMembers: Map<string, string[]>,
  parents: Map<string, string>,
): Set<string> {
  // Build children-of from parents map. Inlined here so this
  // module doesn't depend on parents.ts internals.
  const childrenOfNode = new Map<string, string[]>()
  for (const [child, par] of parents) {
    const list = childrenOfNode.get(par) ?? []
    list.push(child)
    childrenOfNode.set(par, list)
  }
  const out = new Set<string>()
  for (const members of subgraphMembers.values()) {
    const memberSet = new Set(members)
    for (const m of members) {
      for (const c of childrenOfNode.get(m) ?? []) {
        if (!memberSet.has(c)) {
          out.add(m)
          break
        }
      }
    }
  }
  return out
}

/**
 * Which blocks have a root that emits externally? Used by
 * {@link ./internal.ts | layoutBlockInternal} to switch to
 * the emitter-on-top, chain-on-side layout. A block is
 * external-emitting iff its intra-root (the member whose tree
 * parent is outside the block) has a tree-child outside the
 * block too. That intra-root is structurally an emitter from
 * the outer tree's view.
 */
export function findExternalEmitterBlocks(
  blockMembers: BlockMembers,
  parents: Map<string, string>,
): Set<string> {
  const out = new Set<string>()
  for (const [blockId, members] of blockMembers) {
    if (members.length < 2) continue
    const memberSet = new Set(members)
    const intraRoot = members.find((m) => {
      const p = parents.get(m)
      return !p || !memberSet.has(p)
    })
    if (!intraRoot) continue
    let hasExternal = false
    for (const [child, par] of parents) {
      if (par !== intraRoot) continue
      if (!memberSet.has(child)) {
        hasExternal = true
        break
      }
    }
    if (hasExternal) out.add(blockId)
  }
  return out
}
