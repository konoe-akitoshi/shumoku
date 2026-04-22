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

import type { Link, NetworkGraph, Node, Subgraph } from '../models/types.js'
import { routeEdges } from './libavoid-router.js'
import { computeNodeSize } from './network-layout.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

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
 * Collect all obstacles as center-based rects, excluding entities related to `excludeId`.
 * Unified: both nodes and subgraphs are treated as rectangles.
 */
export function collectObstacles(
  excludeId: string,
  excludeParent: string | undefined,
  nodes: Map<string, Node>,
  subgraphs?: Map<string, Subgraph>,
): { x: number; y: number; w: number; h: number }[] {
  const obstacles: { x: number; y: number; w: number; h: number }[] = []

  for (const [nid, n] of nodes) {
    if (nid === excludeId) continue
    if (!n.position) continue
    const size = computeNodeSize(n)
    obstacles.push({ x: n.position.x, y: n.position.y, w: size.width, h: size.height })
  }

  if (subgraphs) {
    for (const [sgId, sg] of subgraphs) {
      if (sgId === excludeId) continue
      if (!sg.bounds) continue
      // Skip if the moving entity belongs to this subgraph
      if (excludeParent && isChildOf(excludeParent, sgId, subgraphs)) continue
      obstacles.push(boundsToRect(sg.bounds))
    }
  }

  return obstacles
}

/**
 * Resolve position of any rectangle against all obstacles (nodes + subgraphs).
 * Used for both node placement and subgraph placement.
 */
export function resolvePosition(
  rect: { x: number; y: number; w: number; h: number },
  obstacles: { x: number; y: number; w: number; h: number }[],
  gap = DEFAULT_NODE_GAP,
): { x: number; y: number } {
  let fx = rect.x
  let fy = rect.y
  for (const obs of obstacles) {
    const moving = { x: fx, y: fy, w: rect.w, h: rect.h }
    if (nodesOverlap(moving, obs, gap)) {
      const resolved = resolveCollision(moving, obs, gap)
      fx = resolved.x
      fy = resolved.y
    }
  }
  return { x: fx, y: fy }
}

/**
 * Resolve a node's position against all other entities.
 * Wrapper around resolvePosition for backward compatibility.
 */
export function resolveNodePosition(
  id: string,
  x: number,
  y: number,
  nodes: Map<string, Node>,
  gap = DEFAULT_NODE_GAP,
  subgraphs?: Map<string, Subgraph>,
): { x: number; y: number } {
  const node = nodes.get(id)
  if (!node) return { x, y }
  const size = computeNodeSize(node)
  const obstacles = collectObstacles(id, node.parent, nodes, subgraphs)
  return resolvePosition({ x, y, w: size.width, h: size.height }, obstacles, gap)
}

/**
 * Place a single unpositioned node into an existing graph with collision
 * avoidance. Thin wrapper around resolvePosition/collectObstacles — the
 * primitive used when loading a partially-positioned graph or adding a
 * node at runtime, without having to re-run the full layout pass.
 */
export function placeNode(
  node: Node,
  graph: { nodes: Map<string, Node>; subgraphs?: Map<string, Subgraph> },
  initial: { x: number; y: number },
  gap = DEFAULT_NODE_GAP,
): { x: number; y: number } {
  const size = computeNodeSize(node)
  const obstacles = collectObstacles(node.id, node.parent, graph.nodes, graph.subgraphs)
  return resolvePosition(
    { x: initial.x, y: initial.y, w: size.width, h: size.height },
    obstacles,
    gap,
  )
}

/** Check if parentId is sgId or a descendant of sgId */
function isChildOf(
  parentId: string | undefined,
  sgId: string,
  subgraphs: Map<string, Subgraph>,
): boolean {
  let current = parentId
  const visited = new Set<string>()
  while (current) {
    if (current === sgId) return true
    if (visited.has(current)) return false
    visited.add(current)
    const sg = subgraphs.get(current)
    current = sg?.parent
  }
  return false
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
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  for (const [nodeId, node] of nodes) {
    if (node.parent !== sgId) continue
    if (!node.position) continue
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
    if (child.parent !== sgId) continue
    if (!child.bounds) continue
    subgraphs.set(childId, {
      ...child,
      bounds: { ...child.bounds, x: child.bounds.x + dx, y: child.bounds.y + dy },
    })
    shiftContents(childId, dx, dy, nodes, subgraphs, ports)
  }
}

/**
 * Rebalance the entire layout after any mutation.
 * Uniform algorithm:
 *   1. Recompute subgraph bounds (bottom-up, deepest first)
 *   2. Resolve subgraph vs subgraph sibling collisions
 *   3. Resolve subgraph vs free node collisions (push nodes away)
 */
export function rebalanceSubgraphs(
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
  ports: Map<string, ResolvedPort>,
): void {
  // Build depth map
  const depthOf = (sgId: string, visited = new Set<string>()): number => {
    if (visited.has(sgId)) return 0
    visited.add(sgId)
    const sg = subgraphs.get(sgId)
    if (!sg?.parent) return 0
    return 1 + depthOf(sg.parent, visited)
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
      if (n.parent !== sgId) continue
      if (!n.position) continue
      hasChildren = true
      const size = computeNodeSize(n)
      const hw = size.width / 2
      const hh = size.height / 2
      minX = Math.min(minX, n.position.x - hw)
      minY = Math.min(minY, n.position.y - hh)
      maxX = Math.max(maxX, n.position.x + hw)
      maxY = Math.max(maxY, n.position.y + hh)
    }
    for (const child of subgraphs.values()) {
      if (child.parent !== sgId) continue
      if (!child.bounds) continue
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
    if (!sg?.bounds) continue
    const parentId = sg.parent

    for (const [otherId] of subgraphs) {
      if (otherId === sgId) continue
      const other = subgraphs.get(otherId)
      if (!other?.bounds || other.parent !== parentId) continue

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

  // Third pass: push free nodes away from subgraphs they don't belong to
  for (const [nodeId, node] of nodes) {
    if (!node.position) continue
    const size = computeNodeSize(node)
    const obstacles = collectObstacles(nodeId, node.parent, nodes, subgraphs)
    const resolved = resolvePosition(
      { x: node.position.x, y: node.position.y, w: size.width, h: size.height },
      obstacles,
    )
    if (resolved.x !== node.position.x || resolved.y !== node.position.y) {
      const dx = resolved.x - node.position.x
      const dy = resolved.y - node.position.y
      nodes.set(nodeId, { ...node, position: resolved })
      // Shift ports
      for (const [portId, port] of ports) {
        if (port.nodeId !== nodeId) continue
        ports.set(portId, {
          ...port,
          absolutePosition: { x: port.absolutePosition.x + dx, y: port.absolutePosition.y + dy },
        })
      }
    }
  }
}

export async function moveNode(
  id: string,
  x: number,
  y: number,
  layout: {
    nodes: Map<string, Node>
    ports: Map<string, ResolvedPort>
    subgraphs?: Map<string, Subgraph>
  },
  links: Link[],
  gap = DEFAULT_NODE_GAP,
  routeFn = routeEdges,
): Promise<{
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs?: Map<string, Subgraph>
} | null> {
  const node = layout.nodes.get(id)
  if (!node?.position) return null

  // 1. Resolve collisions (nodes + subgraphs)
  const { x: finalX, y: finalY } = resolveNodePosition(
    id,
    x,
    y,
    layout.nodes,
    gap,
    layout.subgraphs,
  )

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
  let newSubgraphs: Map<string, Subgraph> | undefined
  if (layout.subgraphs) {
    newSubgraphs = new Map(layout.subgraphs)
    rebalanceSubgraphs(newNodes, newSubgraphs, newPorts)
  }

  // 5. Re-route edges
  const edges = await routeFn(newNodes, newPorts, links)

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
    nodes: Map<string, Node>
    ports: Map<string, ResolvedPort>
    subgraphs: Map<string, Subgraph>
  },
  links: Link[],
  routeFn = routeEdges,
): Promise<{
  nodes: Map<string, Node>
  ports: Map<string, ResolvedPort>
  edges: Map<string, ResolvedEdge>
  subgraphs: Map<string, Subgraph>
} | null> {
  const sg = layout.subgraphs.get(sgId)
  if (!sg?.bounds) return null

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
  const edges = await routeFn(newNodes, newPorts, links)

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
export function detectClickSide(
  clickX: number,
  clickY: number,
  node: Node & { position: { x: number; y: number } },
): Side {
  const size = computeNodeSize(node)
  const cx = node.position.x
  const cy = node.position.y
  const hw = size.width / 2
  const hh = size.height / 2

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
  node: Node & { position: { x: number; y: number } },
  ports: Map<string, ResolvedPort>,
): void {
  const size = computeNodeSize(node)
  const cx = node.position.x
  const cy = node.position.y
  const hw = size.width / 2
  const hh = size.height / 2

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
        ax = cx - hw + size.width * ratio
        ay = cy - hh
        break
      case 'bottom':
        ax = cx - hw + size.width * ratio
        ay = cy + hh
        break
      case 'left':
        ax = cx - hw
        ay = cy - hh + size.height * ratio
        break
      case 'right':
        ax = cx + hw
        ay = cy - hh + size.height * ratio
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
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
): void {
  const node = nodes.get(nodeId)
  if (!node?.position) return

  const size = computeNodeSize(node)
  const counts = countPortsPerSide(nodeId, ports)
  const minSize = computeMinSize(counts, size)

  if (minSize.width !== size.width || minSize.height !== size.height) {
    // Node size is computed from content; if ports require more space,
    // we cannot directly enlarge it (it's derived). The port layout
    // already uses computeNodeSize, so just redistribute.
  }

  const sides: Side[] = ['top', 'bottom', 'left', 'right']
  for (const s of sides) {
    redistributePorts(nodeId, s, node as Node & { position: { x: number; y: number } }, ports)
  }
}

/**
 * Add an empty port to a node on the specified side.
 * Expands the node if needed and redistributes all ports on affected sides.
 */
export function addPort(
  nodeId: string,
  side: Side,
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  existingLinks: Link[],
): { nodes: Map<string, Node>; ports: Map<string, ResolvedPort>; portId: string } | null {
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
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
): { nodes: Map<string, Node>; ports: Map<string, ResolvedPort>; links: Link[] } | null {
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
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
): { nodes: Map<string, Node>; ports: Map<string, ResolvedPort> } | null {
  const port = ports.get(portId)
  if (!port) return null

  const node = nodes.get(port.nodeId)
  if (!node?.position) return null

  const newSide = detectClickSide(svgX, svgY, node as Node & { position: { x: number; y: number } })
  if (newSide === port.side) return null

  const newPorts = new Map(ports)
  newPorts.set(portId, { ...port, side: newSide })

  const newNodes = new Map(nodes)
  rebalanceNode(port.nodeId, newNodes, newPorts)

  return { nodes: newNodes, ports: newPorts }
}
