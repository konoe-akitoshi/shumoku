// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { type NetworkGraph, type Node, resolveNodeSize, type Subgraph } from '@shumoku/core'

/** Saved diagram geometry takes precedence over automatic placement suggestions.
 * Expand derived group enclosures without moving the user's saved nodes. */
export function restoreDiagramGeometry(
  graph: NetworkGraph,
  arranged: { nodes: Map<string, Node>; subgraphs: Map<string, Subgraph> },
): { nodes: Map<string, Node>; subgraphs: Map<string, Subgraph> } {
  const nodes = new Map(arranged.nodes)
  const subgraphs = new Map(arranged.subgraphs)
  for (const saved of graph.nodes) {
    const automatic = nodes.get(saved.id)
    if (!automatic || (!saved.position && !saved.size)) continue
    const node = {
      ...automatic,
      ...(saved.position ? { position: { ...saved.position } } : {}),
      ...(saved.size ? { size: { ...saved.size } } : {}),
    }
    nodes.set(node.id, node)
    if (!node.position) continue
    const size = resolveNodeSize(node)
    let content = {
      x: node.position.x - size.width / 2,
      y: node.position.y - size.height / 2,
      width: size.width,
      height: size.height,
    }
    let parent = node.parent
    const seen = new Set<string>()
    while (parent && !seen.has(parent)) {
      seen.add(parent)
      const group = subgraphs.get(parent)
      if (!group?.bounds) break
      const x = Math.min(group.bounds.x, content.x)
      const y = Math.min(group.bounds.y, content.y)
      const right = Math.max(group.bounds.x + group.bounds.width, content.x + content.width)
      const bottom = Math.max(group.bounds.y + group.bounds.height, content.y + content.height)
      content = { x, y, width: right - x, height: bottom - y }
      subgraphs.set(parent, { ...group, bounds: content })
      parent = group.parent
    }
  }
  return { nodes, subgraphs }
}
