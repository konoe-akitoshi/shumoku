// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Primary-parent extraction.
 *
 * The flat-tree engine operates on a single tree per
 * `NetworkGraph`. To get one from a possibly-cyclic, possibly-
 * multi-parent topology we:
 *
 *   1. Drop redundancy links (they don't represent flow).
 *   2. Honour `shouldFlip` from the caller — typically the
 *      direction-derived "leaf goes to dest side, upstream goes
 *      to source side" normaliser plus a few device-type rules.
 *   3. Pick the first surviving link to each node as that
 *      node's primary parent. Later links are kept as overlay
 *      edges by the router but don't constrain layout.
 *   4. Break any remaining cycles by dropping a back-edge from
 *      each cycle.
 *
 * Result is a partial map: nodes with no incoming structural
 * link aren't in the map (they're roots of the forest).
 */

import type { Link, Node } from '../../models/types.js'

/**
 * Build the primary tree-parent for each node. The map is
 * partial: nodes with no incoming structural edge are absent
 * (roots).
 */
export function buildPrimaryParents(
  links: readonly Link[],
  nodesById: Map<string, Node>,
  shouldFlip: (link: Link) => boolean,
): Map<string, string> {
  const primary = new Map<string, string>()
  for (const link of links) {
    if (link.redundancy) continue
    const flip = shouldFlip(link)
    const from = flip ? link.to : link.from
    const to = flip ? link.from : link.to
    if (from.node === to.node) continue
    if (!nodesById.has(from.node) || !nodesById.has(to.node)) continue
    if (primary.has(to.node)) continue
    primary.set(to.node, from.node)
  }
  return primary
}

/**
 * Drop the entry for any node whose parent chain leads back to
 * itself. After this pass `parents` is a forest (no cycles).
 *
 * Algorithm:
 *
 *   1. Iterate start nodes in stable lexical order so the choice
 *      of which edge to break is independent of Map insertion
 *      order (i.e. of YAML / API call ordering).
 *   2. For each unbroken node, walk the parent chain, remembering
 *      the path. When a node is revisited, slice the cycle out
 *      of the path.
 *   3. Break the edge from the *lexically-last* node in the
 *      cycle. That heuristic keeps shorter / alphabetically-
 *      earlier ids (often the "canonical" or "core" devices in
 *      a network) as the surviving parents and pushes the break
 *      onto the leaf-ish end. Stable + a mild semantic bias.
 *   4. Skip nodes that became roots in earlier iterations so we
 *      don't over-remove edges in tangled graphs.
 */
export function breakCycles(parents: Map<string, string>): void {
  const startNodes = [...parents.keys()].sort((a, b) => a.localeCompare(b))
  for (const start of startNodes) {
    if (!parents.has(start)) continue
    const path: string[] = []
    const seen = new Set<string>()
    let cur: string | undefined = start
    while (cur !== undefined) {
      if (seen.has(cur)) {
        const cycleStart = path.indexOf(cur)
        const cycleNodes = path.slice(cycleStart)
        let victim = cycleNodes[0] ?? cur
        for (const c of cycleNodes) {
          if (c.localeCompare(victim) > 0) victim = c
        }
        parents.delete(victim)
        break
      }
      seen.add(cur)
      path.push(cur)
      cur = parents.get(cur)
    }
  }
}

/**
 * Convenience: build the children-of map (parent → ordered list
 * of children) from a primary-parent map. Many later passes
 * need this view; computing it once at the top of the pipeline
 * keeps them linear.
 */
export function buildChildrenOf(parents: Map<string, string>): Map<string, string[]> {
  const childrenOf = new Map<string, string[]>()
  for (const [child, par] of parents) {
    const list = childrenOf.get(par) ?? []
    list.push(child)
    childrenOf.set(par, list)
  }
  return childrenOf
}
