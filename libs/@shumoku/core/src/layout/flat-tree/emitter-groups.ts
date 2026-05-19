// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Emitter-group detection and orientation classification.
 *
 * A **peer-emitter group** is a set of ≥2 emitter blocks that
 * belong to the same subgraph and are connected internally
 * (their members reach each other via primary tree-edges within
 * the subgraph). The current engine treats such groups as a
 * cascade — spine-aligning later emitters onto the upstream
 * emitter's x column — producing a narrow vertical strip.
 *
 * For many real network topologies (e.g. a NOC with two
 * distribution switches each serving a different floor) the
 * "peer" reading is more natural than the cascade reading: the
 * two emitters are siblings in spirit, not in flow. Rendering
 * them side-by-side at the same outer-tree depth with their
 * downstream subgraphs fanning out below each makes the
 * topology read more clearly.
 *
 * This module decides whether a same-subgraph emitter group
 * should be rendered as a **horizontal peer row** instead of
 * the default vertical-cascade strip. The classification is
 * intentionally conservative — only clear-cut peer cases
 * trigger the override; anything ambiguous keeps today's
 * vertical behaviour, matching the network-engineer expectation
 * that vertical flow is the default reading.
 *
 * Output: a map keyed by the group's "anchor" block (the
 * upstream-most member) to the list of peer blocks it covers.
 * The outer-tree assembly uses this to override block-parent
 * relations so peers share an outer-tree parent.
 */

import type { Node } from '../../models/types.js'
import type { BlockId, BlockMembers } from './types.js'

export interface PeerEmitterGroup {
  /** Subgraph id the group belongs to. */
  subgraph: string
  /** Member blocks of the group, deterministically ordered (anchor first). */
  blocks: BlockId[]
  /**
   * The block containing the member whose primary parent lies
   * OUTSIDE the group (the upstream entry point). Other group
   * members will be reparented to share the anchor's outer-tree
   * parent so they end up as outer-tree siblings.
   */
  anchor: BlockId
}

/**
 * Detect peer-emitter groups across the graph.
 *
 * Rules (deliberately conservative):
 *   1. Group candidates: all single-member emitter blocks
 *      sharing a subgraph (multi-emitter subgraphs collapse
 *      each emitter into its own block in `blocks.ts`).
 *   2. Group connectivity: the candidate blocks must be
 *      connected via primary tree-edges restricted to the
 *      shared subgraph. Disconnected emitter sets in the same
 *      subgraph are NOT a peer group.
 *   3. Group size: exactly 2 emitters. With 3+, the engine
 *      defaults back to vertical because false-horizontal can
 *      misread cascade topologies as peer redundancy (see
 *      Codex review on the original PR).
 *
 * The 2-emitter limit is a conservative starting point. Future
 * iterations can extend to N>2 once a deadband / classifier
 * lands that distinguishes cascade vs peer for larger groups.
 */
export function detectPeerEmitterGroups(
  blockMembers: BlockMembers,
  parents: Map<string, string>,
  nodesById: Map<string, Node>,
): PeerEmitterGroup[] {
  // Bucket single-member blocks by subgraph.
  const bySubgraph = new Map<string, BlockId[]>()
  for (const [blockId, members] of blockMembers) {
    if (members.length !== 1) continue
    const member = members[0]
    if (!member) continue
    const sg = nodesById.get(member)?.parent
    if (!sg) continue
    const list = bySubgraph.get(sg) ?? []
    list.push(blockId)
    bySubgraph.set(sg, list)
  }

  const out: PeerEmitterGroup[] = []
  for (const [sg, blocks] of bySubgraph) {
    // 2-emitter limit (see rule 3 above).
    if (blocks.length !== 2) continue

    // Connectivity check: the two emitters must be linked via
    // a primary edge whose endpoint is the OTHER emitter
    // (direct chain). This rules out two unrelated single-member
    // blocks that just happen to share a subgraph parent.
    const [aBlock, bBlock] = sortBlocks(blocks)
    if (!aBlock || !bBlock) continue
    const aMember = blockMembers.get(aBlock)?.[0]
    const bMember = blockMembers.get(bBlock)?.[0]
    if (!aMember || !bMember) continue
    const aParent = parents.get(aMember)
    const bParent = parents.get(bMember)
    const connected = aParent === bMember || bParent === aMember
    if (!connected) continue

    // Anchor = the member whose primary parent lives OUTSIDE
    // the group (the upstream side of the chain). The
    // downstream member's primary parent is the anchor itself.
    const anchor = aParent === bMember ? bBlock : aBlock

    out.push({
      subgraph: sg,
      blocks: anchor === aBlock ? [aBlock, bBlock] : [bBlock, aBlock],
      anchor,
    })
  }
  return out
}

/**
 * Build the lookup: non-anchor block id → its peer-emitter
 * group's anchor block id. The outer-tree assembly uses this
 * to override block-parent so non-anchors share the anchor's
 * outer-tree parent.
 */
export function buildPeerEmitterAnchorMap(
  groups: readonly PeerEmitterGroup[],
): Map<BlockId, BlockId> {
  const out = new Map<BlockId, BlockId>()
  for (const g of groups) {
    for (const b of g.blocks) {
      if (b !== g.anchor) out.set(b, g.anchor)
    }
  }
  return out
}

function sortBlocks(blocks: readonly BlockId[]): BlockId[] {
  return [...blocks].sort((a, b) => a.localeCompare(b))
}
