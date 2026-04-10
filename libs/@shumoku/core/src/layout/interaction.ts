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

import type { Link, NetworkGraph } from '../models/types.js'
import { routeEdges } from './libavoid-router.js'
import type {
  ResolvedEdge,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from './resolved-types.js'

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
/** Padding inside subgraph bounds around child nodes */
const SUBGRAPH_PADDING = 20
const SUBGRAPH_LABEL_HEIGHT = 28

/** Convert bounds (top-left based) to center-based rect for collision detection */
function boundsToRect(b: { x: number; y: number; width: number; height: number }) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height }
}

/** Shift all nodes, ports, and child subgraphs within a subgraph by (dx, dy) */
function shiftContents(
  sgId: string,
  dx: number,
  dy: number,
  nodes: Map<string, ResolvedNode>,
  subgraphs: Map<string, ResolvedSubgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  for (const [nodeId, node] of nodes) {
    if (node.node.parent !== sgId) continue
    nodes.set(nodeId, { ...node, position: { x: node.position.x + dx, y: node.position.y + dy } })
    for (const [portId, port] of ports) {
      if (port.nodeId !== nodeId) continue
      ports.set(portId, {
        ...port,
        absolutePosition: { x: port.absolutePosition.x + dx, y: port.absolutePosition.y + dy },
      })
    }
  }
  for (const [childId, child] of subgraphs) {
    if (child.subgraph.parent !== sgId) continue
    subgraphs.set(childId, {
      ...child,
      bounds: { ...child.bounds, x: child.bounds.x + dx, y: child.bounds.y + dy },
    })
    shiftContents(childId, dx, dy, nodes, subgraphs, ports)
  }
}

/**
 * Rebalance the entire layout after a node move.
 * Uniform algorithm for subgraphs at all depths:
 *   1. Sort subgraphs by depth (deepest first)
 *   2. Bottom-up: recompute each subgraph's bounds from its children
 *   3. At each level: resolve sibling collisions (push + shift contents)
 */
export function rebalanceSubgraphs(
  nodes: Map<string, ResolvedNode>,
  subgraphs: Map<string, ResolvedSubgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  // Build depth map
  const depthOf = (sgId: string, visited = new Set<string>()): number => {
    if (visited.has(sgId)) return 0
    visited.add(sgId)
    const sg = subgraphs.get(sgId)
    if (!sg?.subgraph.parent) return 0
    return 1 + depthOf(sg.subgraph.parent, visited)
  }

  // Sort subgraphs deepest-first
  const sorted = [...subgraphs.keys()].sort((a, b) => depthOf(b) - depthOf(a))

  // Bottom-up pass: recompute bounds, then resolve sibling collisions
  for (const sgId of sorted) {
    const sg = subgraphs.get(sgId)
    if (!sg) continue

    // Recompute bounds from children (nodes + child subgraphs)
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    let hasChildren = false

    for (const n of nodes.values()) {
      if (n.node.parent !== sgId) continue
      hasChildren = true
      const hw = n.size.width / 2
      const hh = n.size.height / 2
      minX = Math.min(minX, n.position.x - hw)
      minY = Math.min(minY, n.position.y - hh)
      maxX = Math.max(maxX, n.position.x + hw)
      maxY = Math.max(maxY, n.position.y + hh)
    }
    for (const child of subgraphs.values()) {
      if (child.subgraph.parent !== sgId) continue
      hasChildren = true
      minX = Math.min(minX, child.bounds.x)
      minY = Math.min(minY, child.bounds.y)
      maxX = Math.max(maxX, child.bounds.x + child.bounds.width)
      maxY = Math.max(maxY, child.bounds.y + child.bounds.height)
    }

    if (!hasChildren) continue

    subgraphs.set(sgId, {
      ...sg,
      bounds: {
        x: minX - SUBGRAPH_PADDING,
        y: minY - SUBGRAPH_PADDING - SUBGRAPH_LABEL_HEIGHT,
        width: maxX - minX + SUBGRAPH_PADDING * 2,
        height: maxY - minY + SUBGRAPH_PADDING * 2 + SUBGRAPH_LABEL_HEIGHT,
      },
    })
  }

  // Second pass: resolve sibling collisions (shallowest first = reverse order)
  // Using shallowest-first so parent-level collisions are resolved before children
  for (const sgId of [...sorted].reverse()) {
    // Re-fetch from map (may have been shifted by earlier iterations)
    const sg = subgraphs.get(sgId)
    if (!sg) continue
    const parentId = sg.subgraph.parent

    for (const [otherId] of subgraphs) {
      if (otherId === sgId) continue
      const other = subgraphs.get(otherId)
      if (!other || other.subgraph.parent !== parentId) continue

      const a = boundsToRect(sg.bounds)
      const b = boundsToRect(other.bounds)
      if (!nodesOverlap(a, b, DEFAULT_NODE_GAP)) continue

      const resolved = resolveCollision(b, a, DEFAULT_NODE_GAP)
      const dx = resolved.x - b.x
      const dy = resolved.y - b.y
      if (dx === 0 && dy === 0) continue

      subgraphs.set(otherId, {
        ...other,
        bounds: { ...other.bounds, x: other.bounds.x + dx, y: other.bounds.y + dy },
      })
      shiftContents(otherId, dx, dy, nodes, subgraphs, ports)
    }
  }
}

export async function moveNode(
  id: string,
  x: number,
  y: number,
  layout: {
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
    subgraphs?: Map<string, ResolvedSubgraph>
  },
  links: Link[],
  gap = DEFAULT_NODE_GAP,
): Promise<{
  nodes: Map<string, ResolvedNode>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs?: Map<string, ResolvedSubgraph>
} | null> {
  const node = layout.nodes.get(id)
  if (!node) return null

  // 1. Resolve node-node collisions
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

  // 4. Rebalance subgraphs: expand bounds + push siblings
  let newSubgraphs: Map<string, ResolvedSubgraph> | undefined
  if (layout.subgraphs) {
    newSubgraphs = new Map(layout.subgraphs)
    rebalanceSubgraphs(newNodes, newSubgraphs, newPorts)
  }

  // 5. Re-route edges
  const edges = await routeEdges(newNodes, newPorts, links)

  return { nodes: newNodes, ports: newPorts, edges, subgraphs: newSubgraphs }
}

/**
 * Move an entire subgraph (bounds + all contents) by delta from its current position.
 * Resolves sibling collisions after the move.
 */
export async function moveSubgraph(
  sgId: string,
  x: number,
  y: number,
  layout: {
    nodes: Map<string, ResolvedNode>
    ports: Map<string, ResolvedPort>
    subgraphs: Map<string, ResolvedSubgraph>
  },
  links: Link[],
): Promise<{
  nodes: Map<string, ResolvedNode>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs: Map<string, ResolvedSubgraph>
} | null> {
  const sg = layout.subgraphs.get(sgId)
  if (!sg) return null

  const dx = x - sg.bounds.x
  const dy = y - sg.bounds.y
  if (dx === 0 && dy === 0) return null

  const newNodes = new Map(layout.nodes)
  const newPorts = new Map(layout.ports)
  const newSubgraphs = new Map(layout.subgraphs)

  // Shift the subgraph bounds
  newSubgraphs.set(sgId, { ...sg, bounds: { ...sg.bounds, x, y } })

  // Shift all contents
  shiftContents(sgId, dx, dy, newNodes, newSubgraphs, newPorts)

  // Resolve sibling collisions at this level and above
  rebalanceSubgraphs(newNodes, newSubgraphs, newPorts)

  // Re-route edges
  const edges = await routeEdges(newNodes, newPorts, links)

  return { nodes: newNodes, ports: newPorts, edges, subgraphs: newSubgraphs }
}

// ============================================================================
// Link operations
// ============================================================================

/**
 * Check if a link already exists between two ports.
 */
export function linkExists(
  links: Link[],
  fromNodeId: string,
  fromPort: string,
  toNodeId: string,
  toPort: string,
): boolean {
  return links.some((link) => {
    const from = typeof link.from === 'string' ? { node: link.from } : link.from
    const to = typeof link.to === 'string' ? { node: link.to } : link.to
    // Check both directions
    return (
      (from.node === fromNodeId &&
        from.port === fromPort &&
        to.node === toNodeId &&
        to.port === toPort) ||
      (from.node === toNodeId &&
        from.port === toPort &&
        to.node === fromNodeId &&
        to.port === fromPort)
    )
  })
}

/**
 * Add a link between two ports (existing or new).
 *
 * If fromPortId/toPortId refer to existing ports, use them.
 * If toTarget is a nodeId (no port), create a new port on that node.
 *
 * Returns the updated graph with the new link, or null if invalid.
 */
export function addLink(
  graph: NetworkGraph,
  fromPortId: string,
  toPortId: string,
): NetworkGraph | null {
  // Parse "nodeId:portName"
  const fromParts = fromPortId.split(':')
  const toParts = toPortId.split(':')
  if (fromParts.length < 2 || toParts.length < 2) return null

  const fromNode = fromParts[0]
  const fromPort = fromParts.slice(1).join(':')
  const toNode = toParts[0]
  const toPort = toParts.slice(1).join(':')

  if (!fromNode || !fromPort || !toNode || !toPort) return null

  // Don't link same node
  if (fromNode === toNode) return null

  // Check duplicate
  if (linkExists(graph.links, fromNode, fromPort, toNode, toPort)) return null

  const newLink: Link = {
    id: `link-${Date.now()}`,
    from: { node: fromNode, port: fromPort },
    to: { node: toNode, port: toPort },
  }

  return {
    ...graph,
    links: [...graph.links, newLink],
  }
}

/**
 * Generate a new port name for a node that doesn't conflict with existing ports.
 */
export function generatePortName(
  nodeId: string,
  existingLinks: Link[],
  existingPorts?: Map<string, ResolvedPort>,
): string {
  const usedPorts = new Set<string>()
  for (const link of existingLinks) {
    const from = typeof link.from === 'string' ? { node: link.from } : link.from
    const to = typeof link.to === 'string' ? { node: link.to } : link.to
    if (from.node === nodeId && from.port) usedPorts.add(from.port)
    if (to.node === nodeId && to.port) usedPorts.add(to.port)
  }
  // Also check ports already in the layout (may not be linked yet)
  if (existingPorts) {
    for (const port of existingPorts.values()) {
      if (port.nodeId === nodeId) usedPorts.add(port.label)
    }
  }

  let i = 0
  while (true) {
    const name = `eth${i}`
    if (!usedPorts.has(name)) return name
    i++
  }
}

// ============================================================================
// Port operations
// ============================================================================

type Side = 'top' | 'bottom' | 'left' | 'right'

/** Default port size */
const PORT_SIZE = 8

/**
 * Determine which side of a node was clicked based on click position.
 */
export function detectClickSide(clickX: number, clickY: number, node: ResolvedNode): Side {
  const cx = node.position.x
  const cy = node.position.y
  const hw = node.size.width / 2
  const hh = node.size.height / 2

  // Distance to each edge
  const dTop = Math.abs(clickY - (cy - hh))
  const dBottom = Math.abs(clickY - (cy + hh))
  const dLeft = Math.abs(clickX - (cx - hw))
  const dRight = Math.abs(clickX - (cx + hw))

  const min = Math.min(dTop, dBottom, dLeft, dRight)
  if (min === dTop) return 'top'
  if (min === dBottom) return 'bottom'
  if (min === dLeft) return 'left'
  return 'right'
}

/** Minimum spacing between ports on an edge */
const PORT_SPACING = 24

/**
 * Count ports per side for a node.
 */
function countPortsPerSide(nodeId: string, ports: Map<string, ResolvedPort>): Record<Side, number> {
  const counts: Record<Side, number> = { top: 0, bottom: 0, left: 0, right: 0 }
  for (const port of ports.values()) {
    if (port.nodeId === nodeId && port.side) counts[port.side]++
  }
  return counts
}

/**
 * Compute the minimum node size based on port counts.
 * Width must fit max(top, bottom) ports, height must fit max(left, right) ports.
 */
function computeMinSize(
  counts: Record<Side, number>,
  baseSize: { width: number; height: number },
): { width: number; height: number } {
  const hPorts = Math.max(counts.top, counts.bottom)
  const vPorts = Math.max(counts.left, counts.right)
  return {
    width: Math.max(baseSize.width, (hPorts + 1) * PORT_SPACING),
    height: Math.max(baseSize.height, (vPorts + 1) * PORT_SPACING),
  }
}

/**
 * Redistribute all ports on a given side of a node evenly along the edge.
 * Mutates the ports map in place.
 */
function redistributePorts(
  nodeId: string,
  side: Side,
  node: ResolvedNode,
  ports: Map<string, ResolvedPort>,
): void {
  const cx = node.position.x
  const cy = node.position.y
  const hw = node.size.width / 2
  const hh = node.size.height / 2

  const sidePorts: ResolvedPort[] = []
  for (const port of ports.values()) {
    if (port.nodeId === nodeId && port.side === side) sidePorts.push(port)
  }
  if (sidePorts.length === 0) return

  for (const [i, port] of sidePorts.entries()) {
    const ratio = (i + 1) / (sidePorts.length + 1)
    let ax: number
    let ay: number
    switch (side) {
      case 'top':
        ax = cx - hw + node.size.width * ratio
        ay = cy - hh
        break
      case 'bottom':
        ax = cx - hw + node.size.width * ratio
        ay = cy + hh
        break
      case 'left':
        ax = cx - hw
        ay = cy - hh + node.size.height * ratio
        break
      case 'right':
        ax = cx + hw
        ay = cy - hh + node.size.height * ratio
        break
    }
    ports.set(port.id, { ...port, absolutePosition: { x: ax, y: ay } })
  }
}

/**
 * Recalculate node size and redistribute all ports evenly.
 * Shared by addPort and removePort.
 */
function rebalanceNode(
  nodeId: string,
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
): void {
  const node = nodes.get(nodeId)
  if (!node) return

  const counts = countPortsPerSide(nodeId, ports)
  const minSize = computeMinSize(counts, node.size)

  let updatedNode = node
  if (minSize.width !== node.size.width || minSize.height !== node.size.height) {
    updatedNode = {
      ...node,
      size: {
        width: Math.max(node.size.width, minSize.width),
        height: Math.max(node.size.height, minSize.height),
      },
    }
    nodes.set(nodeId, updatedNode)
  }

  const sides: Side[] = ['top', 'bottom', 'left', 'right']
  for (const s of sides) {
    redistributePorts(nodeId, s, updatedNode, ports)
  }
}

/**
 * Add an empty port to a node on the specified side.
 * Expands the node if needed and redistributes all ports on affected sides.
 */
export function addPort(
  nodeId: string,
  side: Side,
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  existingLinks: Link[],
): { nodes: Map<string, ResolvedNode>; ports: Map<string, ResolvedPort>; portId: string } | null {
  const node = nodes.get(nodeId)
  if (!node) return null

  const portName = generatePortName(nodeId, existingLinks, ports)
  const portId = `${nodeId}:${portName}`

  const newPorts = new Map(ports)
  newPorts.set(portId, {
    id: portId,
    nodeId,
    label: portName,
    absolutePosition: { x: 0, y: 0 },
    side,
    size: { width: PORT_SIZE, height: PORT_SIZE },
  })

  const newNodes = new Map(nodes)
  rebalanceNode(nodeId, newNodes, newPorts)

  return { nodes: newNodes, ports: newPorts, portId }
}

/**
 * Remove a port and redistribute remaining ports on the same node.
 * Also removes any links that reference this port.
 * Returns updated nodes, ports, and links.
 */
export function removePort(
  portId: string,
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
): { nodes: Map<string, ResolvedNode>; ports: Map<string, ResolvedPort>; links: Link[] } | null {
  const port = ports.get(portId)
  if (!port) return null

  const nodeId = port.nodeId
  const portName = port.label

  // Remove links referencing this port
  const newLinks = links.filter((l) => {
    const from = typeof l.from === 'string' ? { node: l.from } : l.from
    const to = typeof l.to === 'string' ? { node: l.to } : l.to
    return !(
      (from.node === nodeId && from.port === portName) ||
      (to.node === nodeId && to.port === portName)
    )
  })

  const newPorts = new Map(ports)
  newPorts.delete(portId)

  const newNodes = new Map(nodes)
  rebalanceNode(nodeId, newNodes, newPorts)

  return { nodes: newNodes, ports: newPorts, links: newLinks }
}

/**
 * Move a port to the nearest edge of its node based on cursor position.
 * Changes the port's side and redistributes all ports.
 * Returns null if the side didn't change.
 */
export function movePort(
  portId: string,
  svgX: number,
  svgY: number,
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
): { nodes: Map<string, ResolvedNode>; ports: Map<string, ResolvedPort> } | null {
  const port = ports.get(portId)
  if (!port) return null

  const node = nodes.get(port.nodeId)
  if (!node) return null

  const newSide = detectClickSide(svgX, svgY, node)
  if (newSide === port.side) return null

  const newPorts = new Map(ports)
  newPorts.set(portId, { ...port, side: newSide })

  const newNodes = new Map(nodes)
  rebalanceNode(port.nodeId, newNodes, newPorts)

  return { nodes: newNodes, ports: newPorts }
}
