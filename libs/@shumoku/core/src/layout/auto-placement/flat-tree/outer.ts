// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Outer block tree assembly.
 *
 * Once each block has been laid out internally, the engine
 * builds a tree *of blocks* and feeds it to the Buchheim
 * tidy-tree algorithm. The outer tree's parent-child relation
 * follows the structural link topology, lifted to the block
 * level:
 *
 *   - For each block, find an **entry member** — a member whose
 *     primary tree-parent lives in a *different* block.
 *   - The block's outer-tree parent is the block containing
 *     that entry member's primary parent.
 *   - Blocks with no entry member are outer-tree roots (the
 *     graph's structural roots — typically the WAN or the
 *     top-level "Internet" node).
 *
 * Block sizes reported to tidy-tree include the subgraph hull
 * padding so the resulting positions reserve room for hulls;
 * adjacent hulls touch but don't overlap (#279).
 */

import type { Link, Node } from '../../../models/types.js'
import { sortBlocksBySourcePort } from './sort.js'
import type { BlockChildren, BlockMembers, BlockOfNode, BlockParents } from './types.js'

/**
 * Build the block-level parent map. Each block's outer-tree
 * parent is the block containing the primary parent of the
 * block's entry member (the member crossing into the block
 * from outside).
 */
export function buildBlockParents(
  blockMembers: BlockMembers,
  blockOfNode: BlockOfNode,
  parents: Map<string, string>,
): BlockParents {
  const out: BlockParents = new Map()
  for (const [block, members] of blockMembers) {
    const entry = findEntryMember(block, members, blockOfNode, parents)
    if (!entry) continue
    const externalParent = parents.get(entry)
    if (!externalParent) continue
    const parentBlock = blockOfNode.get(externalParent)
    if (parentBlock && parentBlock !== block) {
      out.set(block, parentBlock)
    }
  }
  return out
}

/**
 * Build the block-level children map and sort each parent's
 * children by source-port label so the tidy-tree's left-to-
 * right child placement matches the natural port sequence.
 */
export function buildBlockChildren(
  blockParents: BlockParents,
  blockMembers: BlockMembers,
  links: readonly Link[],
  nodesById: Map<string, Node>,
  shouldFlip: (link: Link) => boolean,
): BlockChildren {
  const out: BlockChildren = new Map()
  for (const [block, par] of blockParents) {
    const list = out.get(par) ?? []
    list.push(block)
    out.set(par, list)
  }
  for (const [par, kids] of out) {
    out.set(par, sortBlocksBySourcePort(kids, par, blockMembers, links, nodesById, shouldFlip))
  }
  return out
}

/**
 * The block's "entry" member — a member whose primary parent
 * lives outside the block. Returns null if every member's
 * primary parent (if any) is also a member (i.e. the block is
 * an outer-tree root).
 */
function findEntryMember(
  block: string,
  members: readonly string[],
  blockOfNode: BlockOfNode,
  parents: Map<string, string>,
): string | null {
  for (const m of members) {
    const p = parents.get(m)
    if (!p) continue
    const pBlock = blockOfNode.get(p)
    if (pBlock && pBlock !== block) return m
  }
  return null
}
