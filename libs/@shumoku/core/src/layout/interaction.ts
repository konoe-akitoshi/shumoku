// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Interactive layout operations
 *
 * Logic for runtime node manipulation:
 * - Collision detection between nodes
 * - Node move with port tracking and edge re-routing
 */

import type { Link } from '../models/types.js'
import { routeEdges } from './libavoid-router.js'
import type { ResolvedEdge, ResolvedNode, ResolvedPort } from './resolved-types.js'

/** Minimum gap between nodes during collision resolution */
const DEFAULT_NODE_GAP = 8

/**
 * Check if two rectangles (center-based) overlap with a gap.
 */
export function nodesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap = DEFAULT_NODE_GAP,
): boolean {
  return (
    a.x - a.w / 2 - gap < b.x + b.w / 2 &&
    a.x + a.w / 2 + gap > b.x - b.w / 2 &&
    a.y - a.h / 2 - gap < b.y + b.h / 2 &&
    a.y + a.h / 2 + gap > b.y - b.h / 2
  )
}

/**
 * Resolve a collision by pushing the moving node to the nearest escape direction.
 */
export function resolveCollision(
  moving: { x: number; y: number; w: number; h: number },
  obstacle: { x: number; y: number; w: number; h: number },
  gap = DEFAULT_NODE_GAP,
): { x: number; y: number } {
  const escapes = [
    { x: obstacle.x - obstacle.w / 2 - moving.w / 2 - gap, y: moving.y },
    { x: obstacle.x + obstacle.w / 2 + moving.w / 2 + gap, y: moving.y },
    { x: moving.x, y: obstacle.y - obstacle.h / 2 - moving.h / 2 - gap },
    { x: moving.x, y: obstacle.y + obstacle.h / 2 + moving.h / 2 + gap },
  ]

  let best = escapes[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const esc of escapes) {
    const dist = Math.hypot(esc.x - moving.x, esc.y - moving.y)
    if (dist < bestDist) {
      bestDist = dist
      best = esc
    }
  }
  return best ?? { x: moving.x, y: moving.y }
}

/**
 * Apply collision resolution against all other nodes.
 */
export function resolveNodePosition(
  id: string,
  x: number,
  y: number,
  nodes: Map<string, ResolvedNode>,
  gap = DEFAULT_NODE_GAP,
): { x: number; y: number } {
  const node = nodes.get(id)
  if (!node) return { x, y }

  let finalX = x
  let finalY = y

  for (const [otherId, other] of nodes) {
    if (otherId === id) continue
    const moving = { x: finalX, y: finalY, w: node.size.width, h: node.size.height }
    const obstacle = {
      x: other.position.x,
      y: other.position.y,
      w: other.size.width,
      h: other.size.height,
    }
    if (nodesOverlap(moving, obstacle, gap)) {
      const resolved = resolveCollision(moving, obstacle, gap)
      finalX = resolved.x
      finalY = resolved.y
    }
  }

  return { x: finalX, y: finalY }
}

/**
 * Move a node and update the layout reactively:
 * 1. Resolve collisions
 * 2. Update node position
 * 3. Update port positions (sticky to node)
 * 4. Re-route edges via libavoid
 *
 * Returns a new partial layout with updated nodes, ports, and edges.
 */
export async function moveNode(
  id: string,
  x: number,
  y: number,
  layout: {
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
  },
  links: Link[],
  gap = DEFAULT_NODE_GAP,
): Promise<{
  nodes: Map<string, ResolvedNode>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
} | null> {
  const node = layout.nodes.get(id)
  if (!node) return null

  // 1. Resolve collisions
  const { x: finalX, y: finalY } = resolveNodePosition(id, x, y, layout.nodes, gap)

  const dx = finalX - node.position.x
  const dy = finalY - node.position.y
  if (dx === 0 && dy === 0) return null

  // 2. Update node position
  const newNodes = new Map(layout.nodes)
  newNodes.set(id, { ...node, position: { x: finalX, y: finalY } })

  // 3. Update port positions
  const newPorts = new Map(layout.ports)
  for (const [portId, port] of layout.ports) {
    if (port.nodeId !== id) continue
    newPorts.set(portId, {
      ...port,
      absolutePosition: {
        x: port.absolutePosition.x + dx,
        y: port.absolutePosition.y + dy,
      },
    })
  }

  // 4. Re-route edges
  const edges = await routeEdges(newNodes, newPorts, links)

  return { nodes: newNodes, ports: newPorts, edges }
}
